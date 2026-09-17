import OpenAI from "openai";
import type { ResponseInput, ResponseInputItem, ResponseStreamEvent } from "openai/resources/responses/responses";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { loadSiteContent } from "@/actions/content";
import { getCustomer } from "@/lib/customer-session";
import { displayStatus } from "@/lib/orders";
import {
  buildInstructions,
  buildTools,
  resolveCall,
  type AssistantAction,
  type AssistantContext,
} from "@/lib/assistant";

/**
 * El asistente de la tienda, con un modelo de OpenAI.
 *
 * Recibe la conversación entera desde el navegador (no se guarda nada en el
 * servidor: sin cuenta no hay dónde), arma las instrucciones con el contenido
 * publicado en ese momento y devuelve la respuesta a medida que sale, en
 * líneas JSON:
 *
 *   {"t":"delta","v":"texto"}       un trozo más de la respuesta
 *   {"t":"action","v":{...}}        algo que el navegador tiene que hacer
 *   {"t":"error","v":"mensaje"}     se cortó; el texto va para el cliente
 *   {"t":"done"}
 *
 * Las herramientas se resuelven aquí sin esperar al navegador: se valida la
 * llamada, se le contesta al modelo «hecho» y se manda la acción. El modelo
 * sigue hablando sin pausa y el navegador ejecuta la acción cuando le llega.
 *
 * Cuesta plata por mensaje, así que hay freno por IP y topes de largo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** El modelo se cambia por variable de entorno, sin tocar código. */
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const MAX_MESSAGES = 16;
const MAX_CHARS = 1000;
/** Vueltas de herramientas por mensaje: más de esto es un bucle. */
const MAX_ROUNDS = 4;
/** Freno: mensajes por IP en diez minutos. */
const MAX_PER_WINDOW = 40;
const WINDOW_MS = 10 * 60_000;

const hits = new Map<string, { count: number; until: number }>();
function throttled(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || e.until < now) {
    hits.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  e.count++;
  return e.count > MAX_PER_WINDOW;
}

type Incoming = {
  messages?: { role?: string; content?: string }[];
  page?: string;
  cart?: { name?: string; qty?: number }[];
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return bad("El asistente no está configurado todavía. Escríbele a la barra.", 503);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (throttled(ip)) return bad("Muchos mensajes seguidos. Espera un momento.", 429);

  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return bad("Cuerpo inválido.");
  }

  const turns = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).slice(0, MAX_CHARS),
    }));
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return bad("Falta el mensaje.");
  }
  const history: ResponseInput = turns;

  const [site, customer] = await Promise.all([loadSiteContent(), getCustomer()]);

  let orderLines: string[] = [];
  if (customer) {
    const rows = await db
      .select({
        id: orders.id,
        status: orders.status,
        mode: orders.mode,
        outAt: orders.outAt,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.customerId, customer.id))
      .orderBy(desc(orders.createdAt))
      .limit(3);
    orderLines = rows.map(
      (o) =>
        `${o.id} (${o.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}, ${
          o.mode === "envio" ? "domicilio" : "para recoger"
        }): ${displayStatus({ status: o.status, mode: o.mode, outAt: o.outAt?.getTime() ?? null })}`,
    );
  }

  const ctx: AssistantContext = {
    page: typeof body.page === "string" && body.page.startsWith("/") ? body.page.slice(0, 80) : "/",
    cart: (body.cart ?? [])
      .filter((l) => typeof l.name === "string" && typeof l.qty === "number")
      .slice(0, 20)
      .map((l) => ({ name: String(l.name).slice(0, 80), qty: Math.max(1, Math.floor(l.qty!)) })),
    customer: customer ? { name: customer.name, orders: orderLines } : null,
  };

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const instructions = buildInstructions(site, ctx);
  const tools = buildTools(site);
  // Sólo los modelos con razonamiento aceptan `reasoning`; en los demás da
  // error. Y como no se guarda nada en OpenAI (`store: false`), el
  // razonamiento tiene que volver cifrado para poder devolvérselo en la
  // siguiente vuelta de herramientas.
  const reasons = /^(gpt-5|o\d)/.test(MODEL);
  const reasoning = reasons ? { effort: "low" as const } : undefined;
  const include = reasons ? ["reasoning.encrypted_content" as const] : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (t: string, v?: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(v === undefined ? { t } : { t, v }) + "\n"));

      try {
        // Lo que se le manda al modelo crece con cada vuelta: sus propias
        // llamadas y lo que se les contestó. Así no hace falta que OpenAI
        // guarde nada (`store: false`).
        const input: ResponseInput = [...history];

        for (let round = 0; round < MAX_ROUNDS; round++) {
          const events = await client.responses.create({
            model: MODEL,
            instructions,
            input,
            tools,
            store: false,
            stream: true,
            ...(reasoning ? { reasoning } : {}),
            ...(include ? { include } : {}),
          });

          const calls: { call_id: string; name: string; arguments: string }[] = [];
          let outputItems: ResponseInputItem[] = [];

          for await (const ev of events as AsyncIterable<ResponseStreamEvent>) {
            if (ev.type === "response.output_text.delta") {
              emit("delta", ev.delta);
            } else if (ev.type === "response.output_item.done" && ev.item.type === "function_call") {
              calls.push({ call_id: ev.item.call_id, name: ev.item.name, arguments: ev.item.arguments });
            } else if (ev.type === "response.completed") {
              outputItems = ev.response.output as ResponseInputItem[];
            } else if (ev.type === "response.failed" || ev.type === "error") {
              throw new Error("La respuesta falló.");
            }
          }

          if (calls.length === 0) break;

          input.push(...outputItems);
          for (const c of calls) {
            let args: unknown = {};
            try {
              args = JSON.parse(c.arguments || "{}");
            } catch {
              // Argumentos rotos: se resuelve como llamada vacía y el modelo lo sabrá.
            }
            const { action, output } = resolveCall(site, ctx, c.name, args);
            if (action) emit("action", action satisfies AssistantAction);
            input.push({ type: "function_call_output", call_id: c.call_id, output });
          }
        }
        emit("done");
      } catch (err) {
        console.error("[asistente]", err instanceof Error ? err.message : err);
        emit("error", "Se me cruzaron los cables. Inténtalo otra vez o escríbele a la barra.");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Que ningún proxy junte la respuesta entera antes de soltarla.
      "X-Accel-Buffering": "no",
    },
  });
}

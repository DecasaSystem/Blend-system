/**
 * Prueba de la capa que resuelve un pago de Bold: el webhook y la página de
 * vuelta, que mueven un pedido de "esperando pago" a la barra o a "fallido".
 *
 * Levanta un servidor que hace de API de Bold (links de pago), así que no hacen
 * falta llaves reales ni red. El servidor de desarrollo tiene que arrancarse
 * apuntando a él:
 *
 *   $env:BOLD_API_KEY='llave_ficticia'
 *   $env:BOLD_SECRET_KEY='secreto_ficticio'
 *   $env:BOLD_API_BASE='http://localhost:4010'
 *   npm run dev
 *
 *   node --env-file=.env.local scripts/webhook-flow.mjs
 */
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const SECRET = process.argv[3] ?? "secreto_ficticio";
const STUB_PORT = 4010;

const sql = sqlClient();
const { check, crashed, finish } = reporter();

const orderId = `B-TEST-${randomUUID().slice(0, 6)}`;
const LINK = `LNK_${randomUUID().slice(0, 8).toUpperCase()}`;
const TOTAL = 10000;

/** Lo que responderá la API de mentira para cada link consultado. */
const ledger = new Map();

const stub = createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  const id = decodeURIComponent(req.url.split("/").pop());
  const record = ledger.get(id);
  if (!record) {
    res.statusCode = 404;
    res.end(JSON.stringify({ errors: ["no existe"] }));
    return;
  }
  res.end(JSON.stringify(record));
});

await new Promise((resolve) => stub.listen(STUB_PORT, resolve));

/** Un link como los que devuelve `GET /online/link/v1/{id}`. */
function link(status, { id = LINK, total = TOTAL } = {}) {
  return { id, status, total, subtotal: total, reference: orderId, is_sandbox: true };
}

/** Arma un aviso como los que manda Bold, con su firma en la cabecera. */
function buildEvent({
  type = "SALE_APPROVED",
  reference = LINK,
  total = TOTAL,
  paymentId = "PAGO-TEST-1",
} = {}) {
  return JSON.stringify({
    id: randomUUID(),
    type,
    subject: paymentId,
    source: "/payments",
    spec_version: "1.0",
    time: Date.now() * 1e6,
    data: {
      payment_id: paymentId,
      merchant_id: "MERCHANT",
      created_at: new Date().toISOString(),
      amount: { currency: "COP", total, taxes: [], tip: 0 },
      metadata: { reference },
      payment_method: "CARD",
    },
    datacontenttype: "application/json",
  });
}

/** Firma de Bold: HMAC-SHA256 con la llave secreta sobre el cuerpo en base64. */
const sign = (body, secret = SECRET) =>
  createHmac("sha256", secret).update(Buffer.from(body, "utf8").toString("base64")).digest("hex");

async function post(body, signature = sign(body)) {
  const headers = { "content-type": "application/json" };
  if (signature !== null) headers["x-bold-signature"] = signature;
  const res = await fetch(`${URL}/api/bold/webhook`, { method: "POST", headers, body });
  return res.status;
}

async function seed(status = "pago") {
  await sql`
    insert into orders (id, status, mode, store_id, customer, lines, subtotal, delivery, total, payment, payment_ref)
    values (${orderId}, ${status}, 'recoger', 'norte',
            ${sql.json({ name: "Prueba", phone: "300" })},
            ${sql.json([])}, ${TOTAL}, 0, ${TOTAL}, 'tarjeta', ${LINK})
    on conflict (id) do update
      set status = ${status}, paid_at = null, created_at = now(), payment_ref = ${LINK}
  `;
}

async function statusOf() {
  const [row] = await sql`select status, paid_at from orders where id = ${orderId}`;
  return row;
}

/**
 * La página de vuelta, leída completa.
 *
 * Hay un `loading.tsx`, así que Next manda las cabeceras (200) enseguida y
 * termina la página en streaming: hay que esperar el cuerpo entero antes de
 * mirar la base, y un `redirect()` que ocurre después de las cabeceras no
 * puede ser un 307: Next lo inyecta en el cuerpo y el navegador lo sigue.
 * Por eso `redirectsTo` mira las dos cosas.
 */
async function back() {
  const res = await fetch(`${URL}/checkout/listo?pedido=${orderId}`, { redirect: "manual" });
  const body = await res.text();
  const redirectsTo = (path) =>
    (res.status === 307 && (res.headers.get("location") ?? "").includes(path)) ||
    (res.status === 200 && body.includes(path));
  return { status: res.status, body, redirectsTo };
}

try {
  await seed();

  // ------------------------------------------------------------ webhook ---
  const good = buildEvent();

  // --- Sin firma ---
  check("sin firma responde 400", (await post(good, null)) === 400);
  check("sin firma no toca el pedido", (await statusOf()).status === "pago");

  // --- Firmado con otro secreto ---
  check("con secreto equivocado responde 400", (await post(good, sign(good, "otro"))) === 400);
  check("con secreto equivocado no toca el pedido", (await statusOf()).status === "pago");

  // --- Cuerpo alterado después de firmar: la firma cubre todo ---
  const tampered = good.replace(`"total":${TOTAL}`, '"total":100');
  check("si cambian el cuerpo responde 400", (await post(tampered, sign(good))) === 400);
  const swapped = good.replace(`"reference":"${LINK}"`, '"reference":"LNK_OTRO"');
  check("si cambian la referencia responde 400", (await post(swapped, sign(good))) === 400);
  check("nada de eso toca el pedido", (await statusOf()).status === "pago");

  // --- Firma correcta ---
  check("con firma válida responde 200", (await post(good)) === 200);
  const paid = await statusOf();
  check("mueve el pedido a la barra", paid.status === "nuevo", paid.status);
  check("anota cuándo se pagó", paid.paid_at !== null);

  // --- Reenvío: Bold reintenta, no debe deshacer trabajo ---
  await sql`update orders set status = 'preparando' where id = ${orderId}`;
  check("un reenvío responde 200", (await post(buildEvent())) === 200);
  const after = await statusOf();
  check("el reenvío no devuelve el pedido a Nuevo", after.status === "preparando", after.status);

  // --- Rechazado ---
  await seed();
  check("un pago rechazado responde 200", (await post(buildEvent({ type: "SALE_REJECTED" }))) === 200);
  const declined = await statusOf();
  check("un pago rechazado marca el pedido como fallido", declined.status === "fallido", declined.status);
  check("un pago rechazado no anota cobro", declined.paid_at === null);

  // --- El banco aprueba tarde (PSE) un pedido ya dado por fallido: la plata entró ---
  check("una aprobación tardía responde 200", (await post(buildEvent())) === 200);
  const rescued = await statusOf();
  check("una aprobación tardía rescata el pedido fallido", rescued.status === "nuevo", rescued.status);

  // --- Un rechazo tardío no deshace un pedido ya cobrado ---
  check("un rechazo tardío responde 200", (await post(buildEvent({ type: "SALE_REJECTED" }))) === 200);
  check("un rechazo tardío no toca un pedido cobrado", (await statusOf()).status === "nuevo");

  // --- Monto que no cuadra con el pedido ---
  await seed();
  check("un monto que no cuadra responde 200", (await post(buildEvent({ total: 100 }))) === 200);
  check("un monto que no cuadra no libera el pedido", (await statusOf()).status === "pago");

  // --- Referencia desconocida ---
  check("una referencia sin pedido responde 200", (await post(buildEvent({ reference: "LNK_NADIE" }))) === 200);
  check("una referencia sin pedido no toca nada", (await statusOf()).status === "pago");

  // --- Una anulación no es cosa del tablero ---
  check("una anulación responde 200", (await post(buildEvent({ type: "VOID_APPROVED" }))) === 200);
  check("una anulación no toca el pedido", (await statusOf()).status === "pago");

  // ---------------------------------------------------- página de vuelta ---

  // --- Pagado: se confirma al instante consultando el link, sin webhook ---
  ledger.set(LINK, link("PAID"));
  const ok = await back();
  check("la vuelta con link pagado responde 200", ok.status === 200, String(ok.status));
  check("la vuelta con link pagado libera el pedido", (await statusOf()).status === "nuevo");
  check("la vuelta con link pagado lo dice", ok.body.includes("Pago recibido"));

  // --- Pagado pero con otro monto: no se libera ---
  await seed();
  ledger.set(LINK, link("PAID", { total: 100 }));
  await back();
  check("un link pagado con otro monto no libera", (await statusOf()).status === "pago");

  // --- Rechazado: la vuelta manda al checkout con el carrito intacto ---
  ledger.set(LINK, link("REJECTED"));
  const bounced = await back();
  check(
    "la vuelta con pago rechazado redirige al checkout",
    bounced.redirectsTo("/checkout?cancelado=1"),
    String(bounced.status),
  );
  check("la vuelta con pago rechazado marca fallido", (await statusOf()).status === "fallido");

  // --- Pendiente (PSE): la vuelta lo dice y no libera ---
  await seed();
  ledger.set(LINK, link("PROCESSING"));
  const waiting = await back();
  check("la vuelta con pago pendiente responde 200", waiting.status === 200);
  check("la vuelta con pago pendiente no libera", (await statusOf()).status === "pago");
  check("la vuelta con pago pendiente lo dice", waiting.body.includes("procesando"));

  // --- Link abierto: volvió sin pagar ---
  ledger.set(LINK, link("ACTIVE"));
  const open = await back();
  check("la vuelta sin pagar responde 200", open.status === 200);
  check("la vuelta sin pagar no libera", (await statusOf()).status === "pago");
  check("la vuelta sin pagar lo dice", open.body.includes("no est"));

  // --- Bold no responde: se espera, no se inventa nada ---
  ledger.delete(LINK);
  const down = await back();
  check("si Bold no responde la vuelta igual carga", down.status === 200);
  check("si Bold no responde no libera", (await statusOf()).status === "pago");
  check("si Bold no responde dice que confirma", down.body.includes("Confirmando"));

  // --- Enlace vencido: media hora después, la vuelta lo da por perdido ---
  ledger.set(LINK, link("ACTIVE"));
  await sql`update orders set created_at = now() - interval '40 minutes' where id = ${orderId}`;
  const stale = await back();
  check(
    "un pedido vencido redirige al checkout",
    stale.redirectsTo("/checkout?cancelado=1"),
    String(stale.status),
  );
  check("un pedido vencido queda fallido", (await statusOf()).status === "fallido");
} catch (err) {
  crashed(err);
} finally {
  stub.close();
  await sql`delete from orders where id = ${orderId}`;
  const failures = finish();
  await sql.end({ timeout: 5 });
  process.exit(failures ? 1 : 0);
}

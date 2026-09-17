/**
 * Prueba del asistente con IA, sin gastar tokens.
 *   node --env-file=.env.local scripts/assistant-flow.mjs [url]
 *
 * Dos partes:
 * 1. Contra el servidor de verdad: sin OPENAI_API_KEY responde 503 y el chat
 *    lo dice. (Con clave puesta, esta parte manda un mensaje real.)
 * 2. Con la ruta interceptada: se le contesta al navegador lo que contestaría
 *    el servidor (texto a trozos + acciones) y se comprueba que la página
 *    baja a la sección, agrega al carrito y abre la ficha.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright-core";
import { CHROME, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const { check, crashed, finish } = reporter();
const errors = [];
const HAS_KEY = Boolean(process.env.OPENAI_API_KEY);

// Un id de producto real, del contenido publicado.
const sql = sqlClient();
const [row] = await sql`select data->'products'->0->>'id' as id from site_content limit 1`;
const pid = row?.id ?? "mango-terco";
const customerEmail = `cliente-${randomUUID().slice(0, 8)}@blend.test`;

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => {
    // Sin clave, el 503 es lo esperado: no cuenta como error.
    if (m.type() === "error" && !(!HAS_KEY && /503/.test(m.text()))) errors.push(m.text());
  });
});

const ndjson = (events) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";

try {
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const input = page.getByPlaceholder("Pregúntame lo que quieras…");
  const ask = async (text) => {
    await input.fill(text);
    await input.press("Enter");
  };

  // --- La burbuja abre en el asistente, sin cuenta ---
  await page.getByRole("button", { name: "Abrir el chat" }).click();
  check("abre en la pestaña Asistente", await page.getByText("Asistente de BLEND").isVisible());
  check("saluda", await page.getByText(/Soy el asistente de la tienda/).isVisible());
  check(
    "ofrece respuestas rápidas",
    await page.getByRole("button", { name: "¿Qué me recomiendas?" }).isVisible(),
  );

  // --- 1. Contra el servidor ---
  await page.getByRole("button", { name: "¿Qué me recomiendas?" }).click();
  if (HAS_KEY) {
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll("section[aria-label] li");
        return items.length >= 2 && (items[1].textContent ?? "").trim().length > 10;
      },
      null,
      { timeout: 60000 },
    );
    await page.waitForTimeout(6000);
    const reply = await page.locator("section[aria-label] li").nth(1).innerText();
    check("con clave, el modelo responde", reply.trim().length > 10, reply.slice(0, 140));
  } else {
    await page.getByText(/no está configurado todavía/).waitFor({ timeout: 20000 });
    check("sin clave, avisa que no está configurado", true);
  }

  // --- 2. Ruta interceptada: texto + acciones ---
  const seen = [];
  await page.route("**/api/asistente", async (route) => {
    const body = route.request().postDataJSON();
    seen.push(body);
    const last = body.messages[body.messages.length - 1].content;
    let events;
    if (/sedes/.test(last)) {
      events = [
        { t: "action", v: { name: "ir_a", seccion: "tiendas" } },
        { t: "delta", v: "Te llevé a las sedes. " },
        { t: "delta", v: "Estamos en Norte y Centro." },
        { t: "done" },
      ];
    } else if (/ficha/.test(last)) {
      events = [
        { t: "action", v: { name: "abrir_producto", productId: pid } },
        { t: "delta", v: "Aquí tienes la ficha." },
        { t: "done" },
      ];
    } else if (/agrega/.test(last)) {
      events = [
        { t: "action", v: { name: "agregar_al_carrito", productId: pid, sizeId: null, qty: 2 } },
        { t: "delta", v: "Listo, dos en el carrito." },
        { t: "done" },
      ];
    } else {
      events = [{ t: "delta", v: "Hola." }, { t: "done" }];
    }
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body: ndjson(events),
    });
  });

  // ir_a
  await ask("muéstrame las sedes");
  await page.getByText("Estamos en Norte y Centro.").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);
  const tiendasTop = await page.evaluate(
    () => document.getElementById("tiendas")?.getBoundingClientRect().top ?? 9999,
  );
  check("ir_a baja hasta las sedes", tiendasTop < 200, `top=${Math.round(tiendasTop)}`);
  check(
    "manda la página y el carrito al servidor",
    seen[0]?.page === "/" && Array.isArray(seen[0]?.cart),
  );
  check("manda el historial", seen[0]?.messages?.length >= 2);

  // agregar_al_carrito
  await ask("agrega dos");
  await page.getByText("Listo, dos en el carrito.").waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const cartCount = await page.evaluate(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("blend.cart.v2") ?? "null");
      const lines = Array.isArray(parsed) ? parsed : (parsed?.lines ?? []);
      return lines.reduce((n, l) => n + (l.qty ?? 0), 0);
    } catch {
      return -1;
    }
  });
  check("agregar_al_carrito mete dos bebidas", cartCount === 2, `count=${cartCount}`);
  check("el carrito llegó en la siguiente petición", seen[1]?.cart?.length === 0 && seen.length === 2);

  // abrir_producto: la hoja tapa el chat, así que se comprueba y se cierra
  await ask("abre la ficha");
  await page.waitForTimeout(1500);
  const sheetOpen = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')));
  check("abrir_producto abre la hoja", sheetOpen);
  check("y el servidor ya sabía del carrito", seen[2]?.cart?.[0]?.qty === 2, JSON.stringify(seen[2]?.cart));
  await page.screenshot({ path: "shots/asistente-ficha.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // La conversación sobrevive a recargar la página
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Abrir el chat" }).click();
  await page.waitForTimeout(500);
  check(
    "la conversación sigue tras recargar",
    await page.getByText("Listo, dos en el carrito.").isVisible(),
  );
  await page.screenshot({ path: "shots/asistente-chat.png" });

  // --- 3. Desde /cuenta: la ficha no existe ahí, así que lleva a la portada ---
  await page.goto(`${URL}/cuenta/registro`, { waitUntil: "networkidle" });
  await page.getByLabel("Nombre").fill("Camila Ruiz");
  await page.getByLabel("Correo").fill(customerEmail);
  await page.getByLabel("Teléfono").fill("310 123 4567");
  await page.locator('input[name="password"]').fill(randomBytes(18).toString("base64url"));
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL(`${URL}/cuenta`, { timeout: 60000 });
  await page.getByRole("button", { name: "Abrir el chat" }).click();
  check("en /cuenta también está el asistente", await page.getByText("Asistente de BLEND").isVisible());
  await ask("abre la ficha");
  await page.waitForURL(URL + "/", { timeout: 15000 });
  await page.waitForTimeout(2000);
  check("desde /cuenta, abrir_producto lleva a la portada", page.url() === URL + "/");
  check(
    "y abre la ficha al llegar",
    await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]'))),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  check("y el chat se reabre solo", await page.getByText("Aquí tienes la ficha.").last().isVisible());
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await sql`delete from customers where email = ${customerEmail}`;
  await sql.end();
  process.exit(finish(errors));
}

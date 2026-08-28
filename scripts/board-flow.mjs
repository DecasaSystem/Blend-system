/**
 * Prueba del tablero de la barra, incluida la llegada de un pedido
 * hecho desde otra pestaña.
 *   node scripts/board-flow.mjs [url]
 */
import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";
const PASS = "blend2026";

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-CO" });

const errors = [];
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

// --- Tienda: armar y enviar un pedido ---
const shop = await ctx.newPage();
await shop.goto(URL, { waitUntil: "networkidle" });
await shop.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await shop.reload({ waitUntil: "networkidle" });

await shop
  .locator("#menu article")
  .first()
  .getByRole("button", { name: /Agregar .* al pedido/ })
  .click();
await shop.waitForTimeout(400);

// --- Barra: abrir el tablero ANTES de que entre el pedido ---
const board = await ctx.newPage();
await board.goto(`${URL}/equipo`, { waitUntil: "networkidle" });

const gated = await board.getByLabel("Clave de la tienda").isVisible();
check("pide clave antes de mostrar pedidos", gated);

await board.getByLabel("Clave de la tienda").fill("incorrecta");
await board.getByRole("button", { name: "Entrar" }).click();
await board.waitForTimeout(300);
const rejected = await board.getByText(/Esa clave no es/).isVisible();
check("rechaza la clave equivocada", rejected);

await board.getByLabel("Clave de la tienda").fill(PASS);
await board.getByRole("button", { name: "Entrar" }).click();
await board.waitForTimeout(600);
const inside = await board.getByRole("heading", { name: "Nuevo" }).isVisible();
check("entra con la clave correcta", inside);

const emptyAtStart = await board.getByText(/Nada esperando\. Los pedidos entran solos/).isVisible();
check("arranca sin pedidos", emptyAtStart);

// --- Enviar el pedido desde la tienda ---
await shop.goto(`${URL}/checkout`, { waitUntil: "networkidle" });
await shop.getByLabel("Nombre").fill("Camila Ruiz");
await shop.getByLabel("Teléfono").fill("310 123 4567");
await shop.getByLabel("Dirección").fill("Calle 70 #11-32, apto 402");
await shop.getByLabel(/Algo más/).fill("Alergia a la nuez");
await shop.getByRole("button", { name: /^Enviar el pedido/ }).click();
await shop.waitForTimeout(600);

const confirmed = await shop.getByText(/La barra ya lo/).isVisible();
check("la tienda confirma el pedido", confirmed);
const orderId = (
  await shop
    .locator(".u-mono")
    .filter({ hasText: /^B-\d+$/ })
    .first()
    .innerText()
).trim();
check("asigna número de pedido", /^B-\d+$/.test(orderId), orderId);

const cartEmptied = await shop.evaluate(
  () => JSON.parse(localStorage.getItem("blend.cart.v2")).lines.length,
);
check("vacía el carrito al enviar", cartEmptied === 0, `líneas=${cartEmptied}`);

// --- El tablero se entera solo, sin recargar ---
await board.waitForTimeout(1200);
const card = board.locator("article").filter({ hasText: orderId });
check("el pedido llega al tablero sin recargar", (await card.count()) === 1);

const cardText = (await card.first().innerText()).replace(/\n/g, " | ");
check("muestra la dirección", /Calle 70 #11-32/.test(cardText), "");
check("muestra el teléfono", /310 123 4567/.test(cardText), "");
check("resalta la alergia", /Alergia a la nuez/.test(cardText), "");
check("marca que aún no está pagado", /Sin pagar/i.test(cardText), "");

const banner = await board.getByText(new RegExp(`Pedido ${orderId}`)).isVisible();
check("avisa en pantalla que entró", banner);

// --- Mover por los estados ---
await card.first().getByRole("button", { name: "Empezar" }).click();
await board.waitForTimeout(400);
let column = await board
  .locator("section")
  .filter({ has: board.getByRole("heading", { name: "Preparando" }) })
  .innerText();
check("pasa a Preparando", column.includes(orderId));

await board
  .locator("article")
  .filter({ hasText: orderId })
  .getByRole("button", { name: "Marcar listo" })
  .click();
await board.waitForTimeout(400);
await board
  .locator("article")
  .filter({ hasText: orderId })
  .getByRole("button", { name: "Marcar entregado" })
  .click();
await board.waitForTimeout(400);
column = await board
  .locator("section")
  .filter({ has: board.getByRole("heading", { name: "Entregado" }) })
  .innerText();
check("llega a Entregado", column.includes(orderId));

const noAction = await board
  .locator("article")
  .filter({ hasText: orderId })
  .getByRole("button", { name: /Marcar|Empezar/ })
  .count();
check("entregado ya no tiene siguiente paso", noAction === 0);

// --- Devolver un paso ---
await board
  .locator("article")
  .filter({ hasText: orderId })
  .getByRole("button", { name: /Devolver a Listo/ })
  .click();
await board.waitForTimeout(400);
column = await board
  .locator("section")
  .filter({ has: board.getByRole("heading", { name: "Listo" }) })
  .innerText();
check("se puede devolver un paso", column.includes(orderId));

// --- Métricas ---
const metrics = await board.locator("dl").first().innerText();
check(
  "cuenta el pedido del día",
  /Pedidos hoy\s*1/i.test(metrics.replace(/\n/g, " ")),
  metrics.replace(/\n/g, " | "),
);

// --- La sesión de la barra dura la pestaña ---
await board.reload({ waitUntil: "networkidle" });
await board.waitForTimeout(500);
const stillIn = await board.getByRole("heading", { name: "Nuevo" }).isVisible();
check("la sesión sobrevive a recargar", stillIn);

console.log(
  errors.length
    ? `\nERRORES DE CONSOLA:\n${errors.slice(0, 5).join("\n")}`
    : "\nsin errores de consola",
);
console.log(failures ? `\n${failures} fallas` : "\ntodo pasa");

await browser.close();
process.exit(failures ? 1 : 0);

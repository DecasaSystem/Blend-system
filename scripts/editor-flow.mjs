/**
 * Prueba del editor de contenido: se edita en /equipo y la tienda lo muestra.
 *   node scripts/editor-flow.mjs [url]
 */
import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";
const PASS = "blend2026";

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });

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

// --- Entrar al editor ---
const admin = await ctx.newPage();
await admin.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
await admin.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await admin.reload({ waitUntil: "networkidle" });
await admin.getByLabel("Clave de la tienda").fill(PASS);
await admin.getByRole("button", { name: "Entrar" }).click();
await admin.waitForTimeout(500);

await admin.getByRole("tab", { name: /Contenido/ }).click();
await admin.waitForTimeout(400);
check("el editor abre desde la barra", await admin.getByText("Contenido original").isVisible());

const publish = admin.getByRole("button", { name: "Publicar" });
check("Publicar arranca deshabilitado", await publish.isDisabled());

// --- Editar el carrusel ---
const slide = admin.locator("details").first();
await slide.locator("summary").click();
await admin.waitForTimeout(200);
await slide.getByLabel("Palabra destacada").first().fill("RETUMBA");
await admin.waitForTimeout(200);
check("Publicar se activa al editar", await publish.isEnabled());
check(
  "avisa que hay cambios sin publicar",
  await admin.getByText("Cambios sin publicar").isVisible(),
);

// --- Editar un precio del menú ---
await admin.getByRole("button", { name: "Menú", exact: true }).click();
await admin.waitForTimeout(300);
const product = admin.locator("details").filter({ hasText: "Mango Terco" }).first();
await product.locator("summary").click();
await admin.waitForTimeout(200);
await product.getByLabel("Precio", { exact: true }).fill("21500");
await product.getByLabel("Nombre", { exact: true }).fill("Mango Insistente");

// --- Marcar otro como agotado ---
const second = admin.locator("details").filter({ hasText: "Verde Que Te Quiero" }).first();
await second.locator("summary").click();
await admin.waitForTimeout(200);
await second.getByRole("button", { name: /Agotado/ }).click();

await publish.click();
await admin.waitForTimeout(600);
check("confirma que publicó", await admin.getByText(/Publicado\./).isVisible());

// --- La tienda muestra lo publicado ---
const shop = await ctx.newPage();
await shop.goto(URL, { waitUntil: "networkidle" });
await shop.waitForTimeout(600);

check("el carrusel usa el texto nuevo", await shop.getByText("RETUMBA").isVisible());

const card = shop.locator("#menu article").filter({ hasText: "Mango Insistente" }).first();
check("el producto se renombró", (await card.count()) === 1);
check("el precio nuevo se ve", /21\.500/.test(await card.innerText()));

const soldOut = shop.locator("#menu article").filter({ hasText: "Verde Que Te Quiero" }).first();
check("el agotado se marca", /Agotado/i.test(await soldOut.innerText()));
check(
  "no se puede pedir lo agotado",
  await soldOut.getByRole("button", { name: /Agregar .* al pedido/ }).isDisabled(),
);

// --- El precio nuevo llega al carrito ---
await card.getByRole("button", { name: /Agregar .* al pedido/ }).click();
await shop.waitForTimeout(500);
await shop
  .locator("header")
  .getByRole("button", { name: /Abrir carrito/ })
  .click();
await shop.waitForTimeout(500);
const drawer = shop.getByRole("dialog", { name: "Tu pedido" });
check("el carrito cobra el precio nuevo", /21\.500/.test(await drawer.innerText()));

// --- Los toppings editados cambian el precio ---
await shop.keyboard.press("Escape");
await admin.bringToFront();
await admin.getByRole("button", { name: "Menú", exact: true }).click();
await admin.waitForTimeout(300);
const topping = admin.locator("label").filter({ hasText: "Nombre" }).last();
await admin.waitForTimeout(100);
await topping.locator("input").fill("Granola doble");
await admin.getByRole("button", { name: "Publicar" }).click();
await admin.waitForTimeout(600);

await shop.bringToFront();
await shop.reload({ waitUntil: "networkidle" });
await shop.waitForTimeout(600);
await shop.locator("#menu article").first().locator("h3").click();
await shop.waitForTimeout(500);
const sheet = shop.getByRole("dialog").first();
check("el topping renombrado aparece", await sheet.getByText("Granola doble").isVisible());

// --- Restaurar deja todo como estaba ---
await admin.bringToFront();
admin.once("dialog", (d) => d.accept());
await admin.getByRole("button", { name: "Restaurar" }).click();
await admin.waitForTimeout(600);
check("restaurar avisa", await admin.getByText("Contenido restaurado.").isVisible());
// El aviso dura 3 s; después vuelve el estado en reposo.
await admin.waitForTimeout(3000);
check("el editor queda en el original", await admin.getByText("Contenido original").isVisible());

await shop.bringToFront();
await shop.reload({ waitUntil: "networkidle" });
await shop.waitForTimeout(600);
check(
  "la tienda vuelve al contenido original",
  (await shop.locator("#menu article").filter({ hasText: "Mango Terco" }).count()) === 1,
);

console.log(
  errors.length
    ? `\nERRORES DE CONSOLA:\n${errors.slice(0, 5).join("\n")}`
    : "\nsin errores de consola",
);
console.log(failures ? `\n${failures} fallas` : "\ntodo pasa");

await browser.close();
process.exit(failures ? 1 : 0);

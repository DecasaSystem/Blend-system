/**
 * Prueba del editor contra la base de datos: se publica en la barra y la
 * tienda lo sirve desde el servidor.
 *   node --env-file=.env.local scripts/editor-flow.mjs [url]
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

const user = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

try {
  await sql`delete from site_content`;

  const admin = await ctx.newPage();
  await login(admin, URL, user);
  await admin.getByRole("tab", { name: /Contenido/ }).click();
  await admin.waitForTimeout(600);
  check("el editor abre desde la barra", await admin.getByText("Contenido original").isVisible());

  const publish = admin.getByRole("button", { name: "Publicar" });
  check("Publicar arranca deshabilitado", await publish.isDisabled());

  // --- Editar el carrusel ---
  const slide = admin.locator("details").first();
  await slide.locator("summary").click();
  await admin.waitForTimeout(300);
  await slide.getByLabel("Palabra destacada").first().fill("RETUMBA");
  await admin.waitForTimeout(300);
  check("Publicar se activa al editar", await publish.isEnabled());

  // --- Editar precio y nombre ---
  await admin.getByRole("button", { name: "Menú", exact: true }).click();
  await admin.waitForTimeout(400);
  const product = admin.locator("details").filter({ hasText: "Mango Terco" }).first();
  await product.locator("summary").click();
  await admin.waitForTimeout(300);
  // El precio vive por vaso: se cambia el del chico, que es el que anuncia el menú.
  await product.getByLabel("Chico · 350 ml", { exact: true }).fill("21500");
  await product.getByLabel("Nombre", { exact: true }).fill("Mango Insistente");

  const second = admin.locator("details").filter({ hasText: "Verde Que Te Quiero" }).first();
  await second.locator("summary").click();
  await admin.waitForTimeout(300);
  await second.getByRole("button", { name: /Agotado/ }).click();

  await publish.click();
  await admin.waitForTimeout(2500);
  check("confirma que publicó", await admin.getByText(/Publicado\./).isVisible());

  // --- Está en Postgres ---
  const [row] = await sql`select data, updated_by from site_content where id = 'sitio'`;
  check("el contenido queda en Postgres", Boolean(row));
  check("registra quién publicó", row?.updated_by === user.email, row?.updated_by);
  const saved = row.data.products.find((p) => p.id === "mango-terco");
  check(
    "guarda el precio nuevo del vaso chico",
    saved?.prices?.chico === 21500,
    JSON.stringify(saved?.prices),
  );
  check("y no toca el del grande", saved?.prices?.grande === 22400, String(saved?.prices?.grande));

  // --- La tienda lo sirve desde el servidor, no desde el navegador ---
  const shop = await ctx.newPage();
  const html = await (await shop.goto(URL, { waitUntil: "domcontentloaded" })).text();
  check("el HTML del servidor ya trae el cambio", html.includes("Mango Insistente"));
  check("el carrusel usa el texto nuevo", html.includes("RETUMBA"));

  await shop.waitForTimeout(800);
  const card = shop.locator("#menu article").filter({ hasText: "Mango Insistente" }).first();
  check("el precio nuevo se ve", /21\.500/.test(await card.innerText()));

  const soldOut = shop.locator("#menu article").filter({ hasText: "Verde Que Te Quiero" }).first();
  check("el agotado se marca", /Agotado/i.test(await soldOut.innerText()));
  check(
    "no se puede pedir lo agotado",
    await soldOut.getByRole("button", { name: /Agregar .* al pedido/ }).isDisabled(),
  );

  // --- El precio nuevo llega al carrito ---
  await card.getByRole("button", { name: /Agregar .* al pedido/ }).click();
  await shop.waitForTimeout(600);
  await shop
    .locator("header")
    .getByRole("button", { name: /Abrir carrito/ })
    .click();
  await shop.waitForTimeout(600);
  const drawer = shop.getByRole("dialog", { name: "Tu pedido" });
  check("el carrito cobra el precio nuevo", /21\.500/.test(await drawer.innerText()));

  // --- Sin sesión no se puede publicar ---
  const stranger = await browser.newContext();
  const sneak = await stranger.newPage();
  await sneak.goto(URL, { waitUntil: "networkidle" });
  await sneak.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check("sin sesión no se llega al editor", sneak.url().endsWith("/equipo/login"));
  await stranger.close();

  // --- Restaurar ---
  await admin.bringToFront();
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Restaurar" }).click();
  await admin.waitForTimeout(2500);
  const [gone] = await sql`select count(*)::int as n from site_content`;
  check("restaurar borra lo publicado", gone.n === 0, `${gone.n} filas`);

  await shop.bringToFront();
  await shop.reload({ waitUntil: "networkidle" });
  await shop.waitForTimeout(800);
  check(
    "la tienda vuelve al contenido original",
    (await shop.locator("#menu article").filter({ hasText: "Mango Terco" }).count()) === 1,
  );
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await deleteUser(sql, user.email);
  await sql`delete from site_content`;
  const failures = finish(errors);
  await sql.end({ timeout: 5 });
  process.exit(failures ? 1 : 0);
}

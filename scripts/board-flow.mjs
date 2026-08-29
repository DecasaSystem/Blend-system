/**
 * Prueba del tablero contra la base de datos: la tienda pide, la barra lo ve.
 *   node --env-file=.env.local scripts/board-flow.mjs [url]
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

let orderId = null;

try {
  await sql`delete from orders`;

  // --- La barra, abierta antes de que entre nada ---
  const board = await ctx.newPage();
  await login(board, URL, user);
  await board.waitForTimeout(1000);
  check("arranca sin pedidos", await board.getByText(/Nada esperando/).first().isVisible());

  // --- La tienda hace un pedido ---
  const shop = await ctx.newPage();
  await shop.goto(URL, { waitUntil: "networkidle" });
  await shop.evaluate(() => localStorage.clear());
  await shop.reload({ waitUntil: "networkidle" });
  await shop
    .locator("#menu article")
    .first()
    .getByRole("button", { name: /Agregar .* al pedido/ })
    .click();
  await shop.waitForTimeout(500);

  await shop.goto(`${URL}/checkout`, { waitUntil: "networkidle" });
  await shop.getByLabel("Nombre").fill("Camila Ruiz");
  await shop.getByLabel("Teléfono").fill("310 123 4567");
  await shop.getByLabel("Dirección").fill("Cra. 14 #12-40, apto 302");
  await shop.getByLabel(/Algo más/).fill("Alergia a la nuez");
  await shop.getByRole("button", { name: /^Enviar el pedido/ }).click();
  await shop.waitForTimeout(2500);

  check("la tienda confirma el pedido", await shop.getByText(/La barra ya lo/).isVisible());
  orderId = (
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

  // --- Está en la base, no sólo en pantalla ---
  const [row] = await sql`select id, status, total, customer from orders where id = ${orderId}`;
  check("el pedido queda guardado en Postgres", Boolean(row));
  check("entra como nuevo", row?.status === "nuevo", row?.status);
  check("guarda la dirección", /Cra. 14 #12-40/.test(row?.customer?.address ?? ""));

  // --- El tablero se entera solo (consulta cada 4 s) ---
  const card = board.locator("article").filter({ hasText: orderId });
  await card.first().waitFor({ timeout: 20000 }).catch(() => {});
  check("el pedido llega al tablero sin recargar", (await card.count()) === 1);

  const cardText = (await card.first().innerText()).replace(/\n/g, " | ");
  check("muestra la dirección", /Cra. 14 #12-40/.test(cardText));
  check("muestra el teléfono", /310 123 4567/.test(cardText));
  check("resalta la alergia", /Alergia a la nuez/.test(cardText));
  check("marca que aún no está pagado", /Sin pagar/i.test(cardText));

  // --- Mover por los estados, contra el servidor ---
  // Cada paso espera a que la base confirme antes de dar el siguiente: con
  // esperas fijas la prueba competía con el viaje al servidor.
  const waitForStatus = async (want) => {
    for (let i = 0; i < 40; i++) {
      const [r] = await sql`select status from orders where id = ${orderId}`;
      if (r?.status === want) return want;
      await board.waitForTimeout(250);
    }
    const [r] = await sql`select status from orders where id = ${orderId}`;
    return r?.status;
  };

  const press = async (label) =>
    board.locator("article").filter({ hasText: orderId }).getByRole("button", { name: label }).click();

  await press("Empezar");
  check("el estado se guarda en la base", (await waitForStatus("preparando")) === "preparando");

  await press("Marcar listo");
  await waitForStatus("listo");
  await press("Marcar entregado");
  check("llega a Entregado", (await waitForStatus("entregado")) === "entregado");

  // La columna de la interfaz se pone al día en la siguiente consulta
  await board
    .locator("section")
    .filter({ has: board.getByRole("heading", { name: "Entregado" }) })
    .filter({ hasText: orderId })
    .first()
    .waitFor({ timeout: 15000 });
  check("la columna Entregado lo muestra", true);

  // --- Y sobrevive a recargar, porque ya no vive en el navegador ---
  await board.reload({ waitUntil: "networkidle" });
  await board.waitForTimeout(1500);
  const afterReload = await board
    .locator("section")
    .filter({ has: board.getByRole("heading", { name: "Entregado" }) })
    .innerText();
  check("sigue ahí tras recargar", afterReload.includes(orderId));

  // --- Devolver un paso ---
  await press(/Devolver a Listo/);
  const back = await waitForStatus("listo");
  check("se puede devolver un paso", back === "listo", back);

  // --- Otro navegador, sin sesión, no puede tocar nada ---
  const stranger = await browser.newContext();
  const sneak = await stranger.newPage();
  const res = await sneak.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check("un desconocido no entra al tablero", sneak.url().endsWith("/equipo/login"), String(res?.status()));
  await stranger.close();
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await deleteUser(sql, user.email);
  if (orderId) await sql`delete from orders where id = ${orderId}`;
  const failures = finish(errors);
  await sql.end({ timeout: 5 });
  process.exit(failures ? 1 : 0);
}

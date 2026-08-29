/**
 * Prueba de la capa de pagos.
 *
 * Sin claves de Wompi comprueba que la tienda degrada bien y que el webhook
 * no se deja engañar. Con claves comprueba además que el pedido nace en `pago`
 * y no llega al tablero hasta que el aviso firmado lo confirme.
 *
 *   node --env-file=.env.local scripts/payment-flow.mjs [url]
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];
const configured = Boolean(process.env.WOMPI_PUBLIC_KEY);

const user = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

let orderId = null;

try {
  console.log(configured ? "Wompi configurado" : "Sin claves de Wompi: se prueba el respaldo");

  // --- El webhook existe y rechaza lo que no venga firmado ---
  const ping = await ctx.request.get(`${URL}/api/wompi/webhook`);
  check("la ruta del webhook responde", ping.ok(), String(ping.status()));

  const unsigned = await ctx.request.post(`${URL}/api/wompi/webhook`, {
    data: {
      event: "transaction.updated",
      data: { transaction: { reference: "B-1", status: "APPROVED" } },
    },
  });
  check("rechaza un aviso sin firma", unsigned.status() === 400, `HTTP ${unsigned.status()}`);

  const faked = await ctx.request.post(`${URL}/api/wompi/webhook`, {
    data: {
      event: "transaction.updated",
      timestamp: Math.floor(Date.now() / 1000),
      data: { transaction: { id: "x", status: "APPROVED", reference: "B-1" } },
      signature: { properties: ["transaction.id"], checksum: "0".repeat(64) },
    },
  });
  check("rechaza una firma inventada", faked.status() === 400, `HTTP ${faked.status()}`);

  // --- Armar un pedido en la tienda ---
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

  const hasCardOption = await shop.getByText("Cómo pagas").isVisible();
  check(
    configured ? "ofrece pagar con tarjeta" : "sin claves no ofrece tarjeta",
    hasCardOption === configured,
  );

  await shop.getByLabel("Nombre").fill("Camila Ruiz");
  await shop.getByLabel("Teléfono").fill("310 123 4567");
  await shop.getByLabel("Dirección").fill("Cra. 14 #12-40, apto 302");

  if (!configured) {
    // Respaldo: el pedido sale directo a la barra como pago pendiente.
    await shop.getByRole("button", { name: /^Enviar el pedido/ }).click();
    await shop.waitForTimeout(2500);
    check("se puede pedir sin pasarela", await shop.getByText(/La barra ya lo/).isVisible());

    orderId = (
      await shop
        .locator(".u-mono")
        .filter({ hasText: /^B-\d+$/ })
        .first()
        .innerText()
    ).trim();
    const [row] = await sql`select status, payment from orders where id = ${orderId}`;
    check("entra al tablero directo", row?.status === "nuevo", row?.status);
    check("queda marcado sin pagar", row?.payment === "pendiente", row?.payment);
  } else {
    await shop.getByRole("button", { name: /^Pagar/ }).click();
    await shop.waitForTimeout(6000);
    check(
      "manda a la pasarela de Wompi",
      /checkout\.wompi\.co/.test(shop.url()),
      shop.url().slice(0, 60),
    );

    const [row] = await sql`
      select id, status, payment from orders order by created_at desc limit 1
    `;
    orderId = row?.id;
    check("el pedido nace esperando pago", row?.status === "pago", row?.status);
    check("queda marcado como tarjeta", row?.payment === "tarjeta", row?.payment);
  }

  // --- Un pedido en `pago` no aparece en el tablero ---
  if (configured && orderId) {
    const board = await ctx.newPage();
    await login(board, URL, user);
    await board.waitForTimeout(1500);
    const visible = await board.locator("article").filter({ hasText: orderId }).count();
    check("la barra no ve lo que aún no se ha pagado", visible === 0, `${visible} tarjetas`);

    // El webhook es lo único que lo mueve
    await sql`update orders set status = 'nuevo', paid_at = now() where id = ${orderId}`;
    await board.waitForTimeout(5000);
    const now = await board.locator("article").filter({ hasText: orderId }).count();
    check("aparece en cuanto se confirma el pago", now === 1, `${now} tarjetas`);
    await board.close();
  }
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

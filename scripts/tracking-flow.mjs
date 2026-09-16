/**
 * Prueba del seguimiento del domicilio: el repartidor manda su posición y el
 * cliente lo ve venir en el mapa de su cuenta.
 *   node --env-file=.env.local scripts/tracking-flow.mjs [url]
 *
 * El GPS del repartidor es el que finge Playwright (`context.setGeolocation`),
 * así que se puede «mover la moto» desde aquí y ver que el punto cambia.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

const courier = await createTempUser(sql, { role: "repartidor" });
const customerEmail = `cliente-${randomUUID().slice(0, 8)}@blend.test`;
const customerPassword = randomBytes(18).toString("base64url");
const orderId = `T-${randomUUID().slice(0, 4).toUpperCase()}`;

// Armenia: la sede «centro» está en 4.5339,-75.6811. La moto arranca a ~1 km.
const START = { latitude: 4.5425, longitude: -75.675 };
const NEXT = { latitude: 4.5385, longitude: -75.678 };

const browser = await chromium.launch({ executablePath: CHROME });
const courierCtx = await browser.newContext({
  viewport: { width: 420, height: 860 },
  locale: "es-CO",
  geolocation: START,
  permissions: ["geolocation"],
});
const customerCtx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "es-CO" });
for (const ctx of [courierCtx, customerCtx]) {
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  });
}

async function position() {
  const [row] = await sql`
    select lat, lng, updated_at from courier_positions cp
    join users u on u.id = cp.user_id where u.email = ${courier.email}
  `;
  return row ?? null;
}

try {
  // --- Cliente con cuenta ---
  const customer = await customerCtx.newPage();
  await customer.goto(`${URL}/cuenta/registro`, { waitUntil: "networkidle" });
  await customer.getByLabel("Nombre").fill("Camila Ruiz");
  await customer.getByLabel("Correo").fill(customerEmail);
  await customer.getByLabel("Teléfono").fill("310 123 4567");
  await customer.locator('input[name="password"]').fill(customerPassword);
  await customer.getByRole("button", { name: "Crear cuenta" }).click();
  await customer.waitForURL(`${URL}/cuenta`, { timeout: 60000 });
  const [{ id: customerId }] = await sql`select id from customers where email = ${customerEmail}`;
  const [{ id: courierId }] = await sql`select id from users where email = ${courier.email}`;

  // --- Un domicilio listo, ya asignado, todavía sin salir ---
  await sql`
    insert into orders (id, status, mode, store_id, customer, lines, subtotal, delivery, total,
      payment, channel, customer_id, courier_id, assigned_at)
    values (${orderId}, 'listo', 'envio', 'centro',
      ${sql.json({ name: "Camila Ruiz", phone: "310 123 4567", address: "Cra. 14 #12-40" })},
      ${sql.json([{ key: "x", productId: "p", name: "Matcha latte", color: "#8FD14F", unitPrice: 12000, basePrice: 12000, qty: 1 }])},
      12000, 3000, 15000, 'tarjeta', 'web', ${customerId}, ${courierId}, now())
  `;

  // --- Antes de salir, el cliente no ve mapa ---
  await customer.reload({ waitUntil: "networkidle" });
  check("antes de salir, el pedido aparece", await customer.getByText(orderId).first().isVisible());
  check("antes de salir, no hay mapa", (await customer.locator(".blend-courier").count()) === 0);

  // --- El repartidor entra y sale con el pedido ---
  const rider = await courierCtx.newPage();
  await rider.goto(`${URL}/equipo/login`, { waitUntil: "networkidle" });
  await rider.getByLabel("Correo").fill(courier.email);
  await rider.locator('input[name="password"]').fill(courier.password);
  await rider.getByRole("button", { name: "Entrar" }).click();
  await rider.waitForURL(`${URL}/equipo/reparto`, { timeout: 60000 });
  check("el repartidor ve su pedido", await rider.getByText(orderId).first().isVisible());
  check("sin nada en camino, no manda posición", (await position()) === null);

  await rider.getByRole("button", { name: "Salí con el pedido" }).click();
  await rider.getByText(/El cliente te ve en el mapa/).waitFor({ timeout: 20000 });
  check("al salir, la franja dice que el cliente lo ve", true);
  const first = await position();
  check(
    "la posición queda guardada",
    first && Math.abs(first.lat - START.latitude) < 0.0001 && Math.abs(first.lng - START.longitude) < 0.0001,
    JSON.stringify(first),
  );

  // --- El cliente ve la moto (la página se refresca sola; aquí se acelera) ---
  await customer.reload({ waitUntil: "networkidle" });
  await customer.getByText(/va en camino/).waitFor({ timeout: 20000 });
  check("el cliente ve «va en camino»", true);
  await customer.locator(".blend-courier").waitFor({ timeout: 30000 });
  check("el cliente ve la moto en el mapa", true);
  check("dice «En vivo»", await customer.getByText("En vivo").isVisible());
  await customer.locator("li").filter({ hasText: orderId }).first().screenshot({ path: "shots/tracking-cliente.png" });
  await rider.screenshot({ path: "shots/tracking-repartidor.png" });

  // --- La moto se mueve ---
  // MapLibre coloca el marcador con un transform sobre el propio elemento.
  const before = await customer.evaluate(
    () => document.querySelector(".blend-courier")?.style.transform ?? "",
  );
  await courierCtx.setGeolocation(NEXT);
  await rider.waitForTimeout(7000);
  const moved = await position();
  check(
    "la posición se actualiza al moverse",
    moved && Math.abs(moved.lat - NEXT.latitude) < 0.0001,
    JSON.stringify(moved),
  );
  await customer.waitForTimeout(6000);
  const after = await customer.evaluate(
    () => document.querySelector(".blend-courier")?.style.transform ?? "",
  );
  check("el marcador del cliente se mueve", Boolean(after) && after !== before, `${before} → ${after}`);

  // --- Entregado: la posición desaparece y el cliente deja de ver el mapa ---
  await rider.getByRole("button", { name: /Entregado/ }).click();
  await rider.getByText(/Nada en la calle ahora/).waitFor({ timeout: 20000 });
  await rider.waitForTimeout(1500);
  check("al entregar se borra la posición", (await position()) === null);
  await customer.getByText("Entregado", { exact: true }).waitFor({ timeout: 30000 });
  check("el cliente ve Entregado sin recargar", true);
  check("y ya no hay mapa", (await customer.locator(".blend-courier").count()) === 0);
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await sql`delete from orders where id = ${orderId}`;
  await sql`delete from customers where email = ${customerEmail}`;
  await deleteUser(sql, courier.email);
  await sql.end();
  process.exit(finish(errors));
}

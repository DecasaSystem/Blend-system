/**
 * Prueba de las cuentas de clientes.
 *   node --env-file=.env.local scripts/account-flow.mjs [url]
 */
import { randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { CHROME, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

const email = `cliente-${randomBytes(4).toString("hex")}@blend.test`;
const otherEmail = `otro-${randomBytes(4).toString("hex")}@blend.test`;
const password = randomBytes(12).toString("base64url");

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});
const page = await ctx.newPage();

async function register(target, mail) {
  await target.goto(`${URL}/cuenta/registro`, { waitUntil: "networkidle" });
  await target.getByLabel("Nombre").fill("Camila Ruiz");
  await target.getByLabel("Correo").fill(mail);
  await target.getByLabel("Teléfono").fill("310 123 4567");
  await target.getByLabel("Contraseña").fill(password);
  await target.getByRole("button", { name: "Crear cuenta" }).click();
  await target.waitForURL(`${URL}/cuenta`, { timeout: 60000 });
}

try {
  // --- Sin cuenta, /cuenta manda a entrar ---
  await page.goto(`${URL}/cuenta`, { waitUntil: "networkidle" });
  check("sin cuenta redirige a entrar", page.url().endsWith("/cuenta/entrar"), page.url());

  // --- Contraseña corta ---
  await page.goto(`${URL}/cuenta/registro`, { waitUntil: "networkidle" });
  await page.getByLabel("Nombre").fill("Camila Ruiz");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("corta");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForTimeout(1500);
  check(
    "rechaza contraseñas cortas",
    /10 caracteres/i.test(await page.locator("#account-error").innerText()),
  );

  // --- Registro ---
  await register(page, email);
  check("crea la cuenta y entra", page.url().endsWith("/cuenta"));
  check("saluda por el nombre", await page.getByText(/Hola,/).isVisible());

  const [stored] = await sql`select password_hash, phone from customers where email = ${email}`;
  check(
    "la contraseña se guarda con scrypt",
    stored.password_hash.startsWith("scrypt:") && !stored.password_hash.includes(password),
  );
  check("guarda el teléfono", stored.phone === "310 123 4567", stored.phone);

  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name === "blend_customer");
  check("cookie de cliente httpOnly", session?.httpOnly === true);
  check(
    "la cookie de cliente no es la del equipo",
    !cookies.some((c) => c.name === "blend_session"),
  );

  // --- El mismo correo no se registra dos veces ---
  const dup = await ctx.newPage();
  await dup.goto(`${URL}/cuenta/registro`, { waitUntil: "networkidle" });
  check("con sesión, registro redirige a la cuenta", dup.url().endsWith("/cuenta"), dup.url());
  await dup.close();

  // --- Guardar una dirección ---
  await page.getByRole("button", { name: "+ Añadir" }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Casa, oficina…").fill("Casa");
  await page.getByPlaceholder("Cra. 14 #12-40, apto 302").fill("Cra. 19 #10-55, apto 501");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForTimeout(2000);
  const [addr] = await sql`
    select a.address from addresses a
    join customers c on c.id = a.customer_id
    where c.email = ${email}
  `;
  check("guarda la dirección", addr?.address === "Cra. 19 #10-55, apto 501", addr?.address);

  // --- El checkout llega prellenado y con la dirección guardada ---
  const shop = await ctx.newPage();
  await shop.goto(URL, { waitUntil: "networkidle" });
  check("la barra muestra Mi cuenta", await shop.getByRole("link", { name: "Mi cuenta" }).isVisible());

  await shop.evaluate(() => localStorage.clear());
  await shop.reload({ waitUntil: "networkidle" });
  await shop
    .locator("#menu article")
    .first()
    .getByRole("button", { name: /Agregar .* al pedido/ })
    .click();
  await shop.waitForTimeout(500);
  await shop.goto(`${URL}/checkout`, { waitUntil: "networkidle" });

  check("prellena el nombre", (await shop.getByLabel("Nombre").inputValue()) === "Camila Ruiz");
  check("prellena el teléfono", (await shop.getByLabel("Teléfono").inputValue()) === "310 123 4567");
  check(
    "prellena la dirección guardada",
    (await shop.getByLabel("Dirección").inputValue()) === "Cra. 19 #10-55, apto 501",
  );
  check("ofrece elegir entre direcciones", await shop.getByText("Tus direcciones").isVisible());

  // --- El pedido queda ligado a la cuenta ---
  await shop.getByRole("button", { name: /^Enviar el pedido/ }).click();
  await shop.waitForTimeout(2500);
  const orderId = (
    await shop
      .locator(".u-mono")
      .filter({ hasText: /^B-\d+$/ })
      .first()
      .innerText()
  ).trim();

  const [linked] = await sql`
    select o.id from orders o
    join customers c on c.id = o.customer_id
    where o.id = ${orderId} and c.email = ${email}
  `;
  check("el pedido queda ligado a la cuenta", Boolean(linked), orderId);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check("el pedido aparece en su cuenta", await page.getByText(orderId).first().isVisible());

  // --- Otra persona no ve ese pedido ---
  const otherCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const other = await otherCtx.newPage();
  await register(other, otherEmail);
  await other.waitForTimeout(800);
  const otherText = await other.locator("main").innerText();
  check("otra cuenta no ve pedidos ajenos", !otherText.includes(orderId));
  check("otra cuenta arranca sin pedidos", /Todavía no has pedido nada/.test(otherText));
  await otherCtx.close();

  // --- Un cliente no entra al tablero del equipo ---
  const team = await ctx.newPage();
  await team.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check(
    "un cliente no entra a la vista de equipo",
    team.url().endsWith("/equipo/login"),
    team.url(),
  );
  await team.close();

  // --- Cerrar sesión ---
  await page.bringToFront();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL(`${URL}/`, { timeout: 60000 });
  await page.goto(`${URL}/cuenta`, { waitUntil: "networkidle" });
  check("cerrar sesión cierra la cuenta", page.url().endsWith("/cuenta/entrar"));

  // --- Volver a entrar ---
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${URL}/cuenta`, { timeout: 60000 });
  await page.waitForTimeout(600);
  check("vuelve a entrar y conserva su pedido", await page.getByText(orderId).first().isVisible());
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await sql`delete from orders where customer_id in (select id from customers where email in (${email}, ${otherEmail}))`;
  await sql`delete from customers where email in (${email}, ${otherEmail})`;
  const failures = finish(errors);
  await sql.end({ timeout: 5 });
  process.exit(failures ? 1 : 0);
}

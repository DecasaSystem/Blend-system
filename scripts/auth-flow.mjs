/**
 * Prueba de acceso y sesión.
 *   node --env-file=.env.local scripts/auth-flow.mjs [url]
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, reporter, sqlClient } from "./lib/team.mjs";

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
const page = await ctx.newPage();

try {
  // --- Sin sesión no se llega al tablero ---
  await page.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check("sin sesión redirige al login", page.url().endsWith("/equipo/login"), page.url());

  const leaked = await page.content();
  check(
    "el HTML no filtra nada del tablero",
    !leaked.includes("Ventas del día") && !leaked.includes("Pedido de prueba"),
  );

  // --- Clave equivocada ---
  await page.getByLabel("Correo").fill(user.email);
  await page.locator('input[name="password"]').fill("estaNoEsLaClave");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForTimeout(1200);
  const msg = (await page.locator("#login-error").innerText()).trim();
  check("rechaza la clave equivocada", /incorrectos/i.test(msg), msg);
  check(
    "el error no dice si el correo existe",
    !/correo no existe|no encontrado|no registrado/i.test(msg),
    msg,
  );

  // --- Correo que no existe: mismo mensaje ---
  await page.getByLabel("Correo").fill("nadie@blend.test");
  await page.locator('input[name="password"]').fill("loquesea1234");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForTimeout(1200);
  const msg2 = (await page.locator("#login-error").innerText()).trim();
  check("mismo mensaje para un correo inexistente", msg2 === msg, msg2);

  // --- Entrar de verdad ---
  await page.getByLabel("Correo").fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${URL}/equipo`, { timeout: 60000 });
  // El tablero elige diseño tras montar, así que la columna aparece un instante después.
  const columna = page.getByRole("heading", { name: "Nuevo" });
  await columna.waitFor({ timeout: 15000 }).catch(() => {});
  check("entra con la clave correcta", await columna.isVisible());

  // --- La sesión no vive en el navegador ---
  const storage = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  check(
    "la sesión no queda en localStorage ni sessionStorage",
    !/session|token|blend\.team/i.test(storage.local + storage.session),
    storage.session.slice(0, 60),
  );

  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name === "blend_session");
  check("hay cookie de sesión", Boolean(session));
  check("la cookie es httpOnly", session?.httpOnly === true);
  check("la cookie es sameSite Lax", session?.sameSite === "Lax", String(session?.sameSite));

  // --- En la base sólo hay el hash del token ---
  const [row] = await sql`select id from sessions order by created_at desc limit 1`;
  check(
    "en la base se guarda el hash, no el token",
    Boolean(row) && row.id !== session?.value && row.id.length === 64,
  );

  // --- La contraseña nunca se guarda en claro ---
  const [stored] = await sql`select password_hash from users where email = ${user.email}`;
  check(
    "la contraseña se guarda con scrypt",
    stored.password_hash.startsWith("scrypt:") && !stored.password_hash.includes(user.password),
  );

  // --- La sesión sobrevive a recargar ---
  await page.reload({ waitUntil: "networkidle" });
  check("la sesión sobrevive a recargar", page.url().endsWith("/equipo"));

  // --- Con sesión abierta, /equipo/login no vuelve a pedir la clave ---
  await page.goto(`${URL}/equipo/login`, { waitUntil: "networkidle" });
  check("con sesión, login redirige al tablero", page.url().endsWith("/equipo"), page.url());

  // --- Salir ---
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL(/\/equipo\/login/, { timeout: 60000 });
  check("salir cierra la sesión", page.url().includes("/equipo/login"));

  await page.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check("tras salir el tablero vuelve a estar cerrado", page.url().endsWith("/equipo/login"));

  // Acotado a este usuario: otras pruebas dejan sus propias sesiones abiertas.
  const [left] = await sql`
    select count(*)::int as n
    from sessions s join users u on u.id = s.user_id
    where u.email = ${user.email}
  `;
  check("la sesión se borró de la base", left.n === 0, `${left.n} sesiones`);
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await deleteUser(sql, user.email);
  const failures = finish(errors);
  await sql.end({ timeout: 5 });
  process.exit(failures ? 1 : 0);
}

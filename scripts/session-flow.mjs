/**
 * Prueba de las sesiones del equipo que se perdían.
 *   node --env-file=.env.local scripts/session-flow.mjs [url]
 *
 *  - Una cookie de una sesión ya cerrada no deja a nadie en un bucle entre
 *    /equipo y /equipo/login: se ve el formulario y se puede entrar.
 *  - Una sesión a la que le quedan pocos días se alarga sola mientras el
 *    tablero está abierto, en la base y en la cookie.
 *  - Las respuestas llevan las cabeceras de seguridad.
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const DAY = 24 * 60 * 60 * 1000;
const sql = sqlClient();
const { check, crashed, finish } = reporter();

const user = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "es-CO" });
const page = await ctx.newPage();
const host = new globalThis.URL(URL).hostname;

try {
  // --- Cookie de una sesión que ya no existe ---
  await ctx.addCookies([
    { name: "blend_session", value: "sesion-cerrada", domain: host, path: "/" },
  ]);
  const res = await page.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check("con cookie vieja no hay bucle", res?.ok() ?? false, String(res?.status()));
  check("acaba en el login", page.url().startsWith(`${URL}/equipo/login`), page.url());
  check("se ve el formulario", await page.getByLabel("Correo").isVisible());

  const stale = (await ctx.cookies()).find((c) => c.name === "blend_session");
  check("la cookie vieja se borra", !stale, stale?.value);

  // --- Lo mismo con la cuenta del cliente ---
  await ctx.addCookies([
    { name: "blend_customer", value: "sesion-cerrada", domain: host, path: "/" },
  ]);
  const res2 = await page.goto(`${URL}/cuenta`, { waitUntil: "networkidle" });
  check("cliente: sin bucle", res2?.ok() ?? false, String(res2?.status()));
  check("cliente: acaba en entrar", page.url().startsWith(`${URL}/cuenta/entrar`), page.url());
  const staleCustomer = (await ctx.cookies()).find((c) => c.name === "blend_customer");
  check("cliente: la cookie vieja se borra", !staleCustomer, staleCustomer?.value);

  // --- Entrar sobre la cookie vieja ---
  await ctx.addCookies([
    { name: "blend_session", value: "sesion-cerrada", domain: host, path: "/" },
  ]);
  await login(page, URL, user);
  check("entra con la cookie vieja puesta", page.url() === `${URL}/equipo`, page.url());

  // --- Renovación ---
  const [{ id: userId }] = await sql`select id from users where email = ${user.email}`;
  const before = await sql`select count(*)::int as n from sessions where user_id = ${userId}`;
  check("una sola sesión al entrar", before[0].n === 1, String(before[0].n));

  await sql`update sessions set expires_at = now() + interval '2 days' where user_id = ${userId}`;
  // El tablero consulta cada 4 s con una acción de servidor: ahí se renueva.
  await page.waitForTimeout(9000);
  const [row] = await sql`select expires_at from sessions where user_id = ${userId}`;
  const left = new Date(row.expires_at).getTime() - Date.now();
  check("la sesión se alarga sola", left > 13 * DAY, `${(left / DAY).toFixed(1)} días`);

  const cookie = (await ctx.cookies()).find((c) => c.name === "blend_session");
  const cookieLeft = cookie ? cookie.expires * 1000 - Date.now() : 0;
  check("la cookie también", cookieLeft > 13 * DAY, `${(cookieLeft / DAY).toFixed(1)} días`);
  check("cookie httpOnly", cookie?.httpOnly === true);

  // --- Cabeceras ---
  const head = await fetch(`${URL}/`);
  check("X-Frame-Options", head.headers.get("x-frame-options") === "DENY");
  check("nosniff", head.headers.get("x-content-type-options") === "nosniff");
  check("sin X-Powered-By", !head.headers.has("x-powered-by"));
} catch (err) {
  crashed(err);
} finally {
  await browser.close();
  await deleteUser(sql, user.email);
  await sql.end();
  finish();
}

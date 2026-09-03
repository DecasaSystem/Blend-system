/**
 * Prueba la gestión de cuentas del equipo desde la web y la descarga del CSV
 * de métricas.
 *
 * Lo que más importa aquí no es que los botones funcionen, sino que un usuario
 * de barra no pueda usarlos: la comprobación de rol vive en el servidor, así
 * que se llama a la acción directamente, sin pasar por la interfaz.
 *
 *   node --env-file=.env.local scripts/team-flow.mjs [url]
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

const NUEVO = `barra-${Date.now().toString(36)}@blend.test`;
const CLAVE = "ClaveDePrueba2026";

/** Espera a que una consulta devuelva algo, en vez de dormir un rato fijo. */
async function esperar(consulta, ms = 20000) {
  const hasta = Date.now() + ms;
  for (;;) {
    const r = await consulta();
    if (r) return r;
    if (Date.now() > hasta) return null;
    await new Promise((r) => setTimeout(r, 500));
  }
}

const admin = await createTempUser(sql, { role: "admin" });
const barra = await createTempUser(sql, { role: "barra" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

/** Un pedido de hoy, para que el CSV tenga algo que exportar. */
const PEDIDO = "SEMILLA CSV";
async function sembrarPedido() {
  await sql`
    insert into orders (id, status, status_at, mode, store_id, customer, lines,
                        subtotal, delivery, total, payment, channel, created_at)
    values (${`B-CSV-${Date.now().toString(36)}`}, 'entregado', now(), 'envio', 'norte',
            ${sql.json({ name: PEDIDO, phone: "310 000 0000" })},
            ${sql.json([
              {
                key: "mango-terco-1",
                productId: "mango-terco",
                name: "Mango Terco",
                color: "#FF8A2B",
                unitPrice: 22400,
                basePrice: 17900,
                qty: 2,
                options: {
                  size: "grande",
                  base: "Leche de avena",
                  sweet: "normal",
                  extras: ["Chía"],
                  note: "",
                },
              },
            ])},
            44800, 6900, 51700, 'tarjeta', 'web', now())
  `;
}

try {
  await sembrarPedido();

  // ── Un admin gestiona cuentas ────────────────────────────────────────────
  const page = await ctx.newPage();
  await login(page, URL, admin);

  check(
    "el admin ve la pestaña de cuentas",
    await page.getByRole("tab", { name: "Cuentas" }).isVisible(),
  );
  await page.getByRole("tab", { name: "Cuentas" }).click();
  // Esperar a que aparezca, no un rato fijo: la base es remota y a veces tarda.
  await page.getByText(admin.email).first().waitFor({ timeout: 25000 });
  check("lista las cuentas existentes", true);
  check(
    "no muestra ninguna contraseña",
    !(await page.locator("main").innerText()).includes("scrypt"),
  );

  await page.getByRole("button", { name: "+ Añadir cuenta" }).click();
  await page.getByLabel("Correo").fill(NUEVO);
  await page.getByLabel("Nombre").fill("Cuenta De Prueba");
  await page.getByLabel("Contraseña", { exact: false }).first().fill(CLAVE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  const creada = await esperar(
    async () =>
      (await sql`select role, password_hash from users where email = ${NUEVO}`)[0] ?? null,
  );
  check("la cuenta queda en la base", Boolean(creada), creada?.role);
  check(
    "con la contraseña hasheada, no en claro",
    creada?.password_hash?.startsWith("scrypt:") && !creada.password_hash.includes(CLAVE),
  );

  // La prueba de fuego: que sirva para entrar de verdad. Contexto aparte, o la
  // sesión de admin que ya hay en éste redirigiría el login al tablero.
  const ctxNueva = await browser.newContext({ locale: "es-CO" });
  const nueva = await ctxNueva.newPage();
  await login(nueva, URL, { email: NUEVO, password: CLAVE });
  check("la cuenta nueva entra al tablero", nueva.url().endsWith("/equipo"));
  check(
    "y como barra no ve la pestaña de cuentas",
    (await nueva.getByRole("tab", { name: "Cuentas" }).count()) === 0,
  );

  /*
   * ── La barra no puede gestionar cuentas ─────────────────────────────────
   *
   * Esconder la pestaña no es seguridad: la comprobación está en el servidor.
   * Para llegar hasta ella se asciende al usuario a admin, se abre el panel, y
   * se le devuelve el rol de barra sin recargar. La página sigue pintada, pero
   * la siguiente llamada la hace ya un usuario de barra — que es justo lo que
   * pasaría si a alguien le quitan permisos con la pantalla abierta.
   */
  const ctxBarra = await browser.newContext({ locale: "es-CO" });
  const colado = await ctxBarra.newPage();
  await login(colado, URL, barra);

  await sql`update users set role = 'admin' where email = ${barra.email}`;
  await colado.reload({ waitUntil: "networkidle" });
  await colado.getByRole("tab", { name: "Cuentas" }).click();
  await colado.waitForTimeout(1200);
  await sql`update users set role = 'barra' where email = ${barra.email}`;

  const cuentasAntes = (await sql`select count(*)::int as n from users`)[0].n;

  const COLADA = `colada-${Date.now().toString(36)}@blend.test`;
  await colado.getByRole("button", { name: "+ Añadir cuenta" }).click();
  await colado.getByLabel("Correo").fill(COLADA);
  await colado.getByLabel("Nombre").fill("No Deberia Existir");
  await colado.getByLabel("Contraseña", { exact: false }).first().fill("LoQueSea2026");
  await colado.getByRole("button", { name: "Crear cuenta" }).click();
  await colado.waitForTimeout(2500);

  const [colada] = await sql`select id from users where email = ${COLADA}`;
  check("el servidor no deja crear cuentas a un usuario de barra", !colada);
  check(
    "y el número de cuentas no cambió",
    (await sql`select count(*)::int as n from users`)[0].n === cuentasAntes,
  );

  // ── Cambiar la contraseña cierra las sesiones ────────────────────────────
  const [fila] = await sql`select id from users where email = ${NUEVO}`;
  const sesionesAntes = (
    await sql`select count(*)::int as n from sessions where user_id = ${fila.id}`
  )[0].n;
  check("la cuenta nueva tiene sesión abierta", sesionesAntes > 0, `${sesionesAntes}`);

  await page.getByRole("button", { name: "Contraseña" }).last().click();
  await page.getByLabel("Contraseña nueva").fill("OtraClaveLarga2026");
  await page.getByRole("button", { name: "Cambiar" }).click();

  await esperar(
    async () =>
      (await sql`select count(*)::int as n from sessions where user_id = ${fila.id}`)[0].n === 0 ||
      null,
  );
  const sesionesDespues = (
    await sql`select count(*)::int as n from sessions where user_id = ${fila.id}`
  )[0].n;
  check("cambiar la contraseña cierra sus sesiones", sesionesDespues === 0, `${sesionesDespues}`);

  const rehecha = await esperar(async () => {
    const [r] = await sql`select password_hash from users where email = ${NUEVO}`;
    return r && r.password_hash !== creada?.password_hash ? r : null;
  });
  check("y guarda un hash distinto", Boolean(rehecha));

  // ── El CSV de métricas ───────────────────────────────────────────────────
  await page.getByRole("tab", { name: /Métricas/ }).click();
  await page.waitForTimeout(2500);

  const boton = page.getByRole("button", { name: "Descargar CSV" });
  check("hay botón de descarga", await boton.isVisible());

  if (await boton.isEnabled()) {
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 20000 }),
      boton.click(),
    ]);
    const nombre = descarga.suggestedFilename();
    check(
      "el archivo se llama como toca",
      /^blend-metricas-\d+dias-\d{4}-\d{2}-\d{2}\.csv$/.test(nombre),
      nombre,
    );

    const ruta = await descarga.path();
    const texto = await (await import("node:fs/promises")).readFile(ruta, "utf8");
    check("empieza con BOM, para que Excel no rompa los acentos", texto.charCodeAt(0) === 0xfeff);
    check("trae el bloque de resumen", texto.includes('"Ventas"'));
    check("y el de lo más vendido", texto.includes('"Lo que más se vende"'));
  } else {
    check("el botón de CSV debería estar activo: hay un pedido sembrado", false);
  }
} catch (err) {
  crashed(err);
} finally {
  await sql`delete from orders where customer->>'name' = ${PEDIDO}`;
  await sql`delete from users where email like 'colada-%@blend.test'`;
  await sql`delete from users where email = ${NUEVO}`;
  await deleteUser(sql, admin.email);
  await deleteUser(sql, barra.email);
  await browser.close();
  await sql.end();
}

process.exit(finish(errors) ? 1 : 0);

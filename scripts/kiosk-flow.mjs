/**
 * Prueba el autopedido del mostrador.
 *
 * El recorrido completo: el equipo lo activa, se monta una tablet, un cliente
 * pide sin dar teléfono ni dirección, y el pedido aparece en el tablero.
 *
 * Y lo que no debe pasar: que la tablet sirva para entrar al tablero, que se
 * pueda desbloquear con una clave equivocada, o que alguien desde la web se
 * declare «mostrador» para saltarse el teléfono.
 *
 *   node --env-file=.env.local scripts/kiosk-flow.mjs [url]
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const CLAVE = "QuioscoBlend2026";
const NOMBRE = "Camila Quiosco";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

const admin = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });

const nuevoCtx = async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-CO" });
  c.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  });
  return c;
};

try {
  await sql`delete from kiosk_sessions`;
  await sql`delete from settings where key = 'kiosk.password'`;

  // ── Sin activar, la pantalla no deja entrar ──────────────────────────────
  const ctxTablet = await nuevoCtx();
  const tablet = await ctxTablet.newPage();
  await tablet.goto(`${URL}/quiosco`, { waitUntil: "networkidle" });
  check(
    "sin activar, el quiosco lo dice y no pide clave",
    (await tablet.getByText("todavía no está activado").count()) > 0,
  );

  // ── El equipo lo activa ──────────────────────────────────────────────────
  const ctxAdmin = await nuevoCtx();
  const panel = await ctxAdmin.newPage();
  await login(panel, URL, admin);
  await panel.getByRole("tab", { name: "Cuentas" }).click();
  await panel.waitForTimeout(1200);

  check("el equipo ve el bloque del quiosco", await panel.getByText("Apagado").isVisible());
  await panel.getByLabel("Clave para activarlo").fill(CLAVE);
  await panel.getByRole("button", { name: "Activar" }).click();
  // Esperar a la condición, no a un reloj: guardar y refrescar tarda lo que
  // tarde la base, y con un timeout fijo la prueba falla sin que nada esté mal.
  await panel.getByText("Activo", { exact: true }).waitFor({ timeout: 20000 });
  check("queda activo", true);

  const [guardada] = await sql`select value from settings where key = 'kiosk.password'`;
  check(
    "la clave se guarda hasheada, no en claro",
    guardada?.value?.startsWith("scrypt:") && !guardada.value.includes(CLAVE),
  );

  // ── Se monta la tablet ───────────────────────────────────────────────────
  await tablet.reload({ waitUntil: "networkidle" });
  await tablet.getByLabel("Nombre de la pantalla").fill("Tablet de prueba");
  await tablet.getByLabel("Clave del quiosco").fill("clave-equivocada");
  await tablet.getByRole("button", { name: "Activar esta pantalla" }).click();
  await tablet.getByText("Clave incorrecta.").waitFor({ timeout: 20000 });
  check("con la clave mal, no entra", true);

  await tablet.getByLabel("Clave del quiosco").fill(CLAVE);
  await tablet.getByRole("button", { name: "Activar esta pantalla" }).click();
  await tablet.getByRole("button", { name: "Agregar" }).first().waitFor({ timeout: 25000 });
  check("con la clave buena, la pantalla queda lista", true);

  const galleta = (await ctxTablet.cookies()).find((c) => c.name === "blend_kiosk");
  check("la cookie del quiosco es httpOnly", galleta?.httpOnly === true);

  // ── La tablet no es una llave del tablero ────────────────────────────────
  const espia = await ctxTablet.newPage();
  await espia.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  check(
    "la pantalla NO abre el tablero de pedidos",
    espia.url().includes("/equipo/login"),
    espia.url(),
  );

  // ── Un cliente pide ──────────────────────────────────────────────────────
  check("hay categorías para elegir", (await tablet.getByRole("tab").count()) > 1);

  await tablet.getByRole("button", { name: "Agregar" }).first().click();
  await tablet.waitForTimeout(600);
  check(
    "el carrito de abajo aparece",
    (await tablet.getByRole("button", { name: /Listo ·/ }).count()) === 1,
  );

  // Y una personalizada, para comprobar que la hoja es la misma de la tienda.
  await tablet.getByRole("button", { name: /Elegir Matcha Yuzu/ }).click();
  await tablet.waitForTimeout(800);
  const hoja = tablet.getByRole("dialog");
  check("la hoja de personalización abre en el quiosco", await hoja.isVisible());
  await hoja.getByRole("button", { name: /Grande/ }).click();
  await hoja.getByRole("button", { name: /Agregar ·/ }).click();
  await tablet.waitForTimeout(800);

  await tablet.getByRole("button", { name: /Listo ·/ }).click();
  await tablet.waitForTimeout(800);

  check(
    "no pide dirección",
    (await tablet.getByLabel("Dirección").count()) === 0 &&
      (await tablet.getByPlaceholder(/Cra\./).count()) === 0,
  );
  check("no pide teléfono", (await tablet.getByLabel("Teléfono").count()) === 0);
  check("no ofrece iniciar sesión", (await tablet.getByText(/entra a la tuya/i).count()) === 0);

  await tablet.getByLabel("Nombre para el pedido").fill(NOMBRE);
  await tablet.getByRole("button", { name: /Enviar a la barra/ }).click();
  await tablet.waitForTimeout(3000);

  check("la pantalla canta el número", (await tablet.getByText("Tu número es").count()) > 0);
  check(
    "y el número cabe en la pantalla",
    await tablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );

  const [pedido] = await sql`
    select id, channel, mode, payment, status, customer, total
    from orders where customer->>'name' = ${NOMBRE}
  `;
  check("el pedido llega a la base", Boolean(pedido), pedido?.id);
  check("marcado como mostrador", pedido?.channel === "mostrador", pedido?.channel);
  check("para recoger, no a domicilio", pedido?.mode === "recoger", pedido?.mode);
  check("sin cobrar todavía", pedido?.payment === "pendiente", pedido?.payment);
  check("entra al tablero como nuevo", pedido?.status === "nuevo", pedido?.status);
  check("sin teléfono y sin dirección", !pedido?.customer.phone && !pedido?.customer.address);
  check("con dos bebidas y un total", pedido?.total > 0, `${pedido?.total}`);

  // Y la barra lo ve.
  await panel.getByRole("tab", { name: /Pedidos/ }).click();
  await panel.waitForTimeout(2500);
  check("la barra lo ve en el tablero", (await panel.getByText(NOMBRE).count()) > 0);

  // ── Desde la web nadie se declara «mostrador» ────────────────────────────
  const ctxWeb = await nuevoCtx();
  const web = await ctxWeb.newPage();
  await web.goto(URL, { waitUntil: "networkidle" });
  await web.evaluate(() => {
    localStorage.setItem(
      "blend.cart.v2",
      JSON.stringify({
        lines: [
          {
            key: "mango-terco|chico|Leche de avena|normal||",
            productId: "mango-terco",
            name: "Mango Terco",
            color: "#FF8A2B",
            unitPrice: 17900,
            basePrice: 17900,
            qty: 1,
            options: {
              size: "chico",
              base: "Leche de avena",
              sweet: "normal",
              extras: [],
              note: "",
            },
          },
        ],
        mode: "recoger",
        storeId: "norte",
      }),
    );
  });
  await web.goto(`${URL}/checkout`, { waitUntil: "networkidle" });
  await web.getByLabel("Nombre").fill("Sin Telefono Web");
  // El teléfono es `required` en el formulario, así que se quita para poder
  // enviarlo: lo que se prueba es la comprobación del servidor, no la del HTML.
  await web.evaluate(() => document.querySelector("#telefono")?.removeAttribute("required"));
  await web.getByRole("button", { name: /Enviar el pedido|Pagar/ }).click();
  await web.waitForTimeout(2500);

  const colado = await sql`select id from orders where customer->>'name' = 'Sin Telefono Web'`;
  check("desde la web no se puede pedir sin teléfono", colado.length === 0);

  // ── Desconectar la pantalla desde /equipo ────────────────────────────────
  await panel.getByRole("tab", { name: "Cuentas" }).click();
  await panel.waitForTimeout(1500);
  check(
    "el equipo ve la pantalla conectada",
    await panel.getByText("Tablet de prueba").isVisible(),
  );
  await panel.getByRole("button", { name: "Desconectar" }).click();
  await panel.waitForTimeout(2000);

  check(
    "desconectarla la borra de la base",
    (await sql`select count(*)::int as n from kiosk_sessions`)[0].n === 0,
  );

  await tablet.goto(`${URL}/quiosco`, { waitUntil: "networkidle" });
  check(
    "y la tablet vuelve a pedir la clave",
    (await tablet.getByLabel("Clave del quiosco").count()) === 1,
  );
} catch (err) {
  crashed(err);
} finally {
  await sql`delete from orders where customer->>'name' in (${NOMBRE}, 'Sin Telefono Web')`;
  await sql`delete from kiosk_sessions`;
  await sql`delete from settings where key = 'kiosk.password'`;
  await deleteUser(sql, admin.email);
  await browser.close();
  await sql.end();
}

process.exit(finish(errors) ? 1 : 0);

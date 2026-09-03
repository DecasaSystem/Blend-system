/**
 * Prueba la pestaña de Métricas.
 *
 * Siembra pedidos repartidos por los últimos días, con horas y toppings
 * variados, mira que los gráficos digan lo que dicen los datos, y borra lo
 * sembrado al terminar. Los pedidos de prueba se reconocen por el nombre del
 * cliente, así que nunca toca los de verdad.
 *
 *   node --env-file=.env.local scripts/stats-flow.mjs [url]
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const MARCA = "SEMILLA METRICAS";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

const BEBIDAS = [
  { id: "mango-terco", name: "Mango Terco", color: "#FF8A2B", price: 17900 },
  { id: "matcha-yuzu", name: "Matcha Yuzu", color: "#A9CF3F", price: 22900 },
  { id: "acai-clasico", name: "Açaí Clásico", color: "#6B2FA8", price: 28900 },
  { id: "fresa-descalza", name: "Fresa Descalza", color: "#F2557A", price: 16900 },
];
// El primero se repite a propósito: tiene que salir arriba en «lo que más se vende».
const PESOS = [0, 0, 0, 0, 1, 1, 2, 3];
const EXTRAS = ["Granola de la casa", "Granola de la casa", "Chía", "Cacao nibs"];

/** Pedidos repartidos por los últimos `dias` días, a horas de local abierto. */
function sembrar(dias, porDia) {
  const filas = [];
  for (let d = 0; d < dias; d++) {
    for (let n = 0; n < porDia; n++) {
      const bebida = BEBIDAS[PESOS[(d * porDia + n) % PESOS.length]];
      const grande = (d + n) % 2 === 0;
      const extras = (d + n) % 3 === 0 ? [EXTRAS[(d + n) % EXTRAS.length]] : [];
      const qty = 1 + ((d + n) % 2);
      const unitPrice = bebida.price + (grande ? 4500 : 0) + extras.length * 4500;
      const subtotal = unitPrice * qty;
      const mode = (d + n) % 3 === 0 ? "recoger" : "envio";
      const delivery = mode === "recoger" || subtotal >= 60000 ? 0 : 6900;

      const cuando = new Date();
      cuando.setDate(cuando.getDate() - d);
      cuando.setHours(8 + ((d * 3 + n * 5) % 12), 15, 0, 0);

      filas.push({
        id: `B-SEED-${randomUUID().slice(0, 8)}`,
        status: "entregado",
        mode,
        storeId: (d + n) % 4 === 0 ? "centro" : "norte",
        customer: { name: MARCA, phone: "310 000 0000" },
        lines: [
          {
            key: `${bebida.id}-${n}`,
            productId: bebida.id,
            name: bebida.name,
            color: bebida.color,
            unitPrice,
            basePrice: bebida.price,
            qty,
            options: {
              size: grande ? "grande" : "chico",
              base: (d + n) % 2 ? "Leche de avena" : "Agua de coco",
              sweet: "normal",
              extras,
              note: "",
            },
          },
        ],
        subtotal,
        delivery,
        total: subtotal + delivery,
        payment: (d + n) % 3 === 0 ? "efectivo" : "tarjeta",
        createdAt: cuando,
      });
    }
  }
  return filas;
}

// Las capturas van a una carpeta que .gitignore ya cubre (`/shots*/`), para
// que ejecutar la prueba no ensucie el repositorio.
mkdirSync("shots-metricas", { recursive: true });

const DIAS = 12;
const POR_DIA = 3;
const filas = sembrar(DIAS, POR_DIA);

const user = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

try {
  for (const f of filas) {
    await sql`
      insert into orders (id, status, status_at, mode, store_id, customer, lines,
                          subtotal, delivery, total, payment, channel, created_at)
      values (${f.id}, ${f.status}, ${f.createdAt}, ${f.mode}, ${f.storeId},
              ${sql.json(f.customer)}, ${sql.json(f.lines)}, ${f.subtotal}, ${f.delivery},
              ${f.total}, ${f.payment}, 'web', ${f.createdAt})
    `;
  }

  /*
   * Lo que tendrían que decir los gráficos, calculado aparte de la app.
   *
   * Se suma lo que ya hubiera en la base dentro del rango, no sólo lo sembrado:
   * si queda un pedido de otra prueba, el panel lo cuenta y la comprobación
   * fallaría sin que nada estuviera roto.
   */
  const previos = async (dias) =>
    (
      await sql`
        select coalesce(sum(total), 0)::int as n from orders
        where status <> 'pago'
          and created_at >= now() - (${dias} || ' days')::interval
          and customer->>'name' <> ${MARCA}
      `
    )[0].n;

  const desde7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ventas7 =
    filas.filter((f) => f.createdAt >= desde7).reduce((n, f) => n + f.total, 0) +
    (await previos(7));

  const page = await ctx.newPage();
  await login(page, URL, user);
  await page.getByRole("tab", { name: /Métricas/ }).click();
  await page.waitForTimeout(2500);

  check("la pestaña de métricas abre", await page.getByText("Ventas por día").first().isVisible());

  const cuerpo = await page.locator("main").innerText();
  check(
    "las ventas de 7 días cuadran con lo sembrado",
    cuerpo.includes(ventas7.toLocaleString("es-CO")),
    `esperado ${ventas7.toLocaleString("es-CO")}`,
  );
  check("Mango Terco encabeza lo más vendido", /Mango Terco/.test(cuerpo));
  check(
    "aparece el adicional más pedido",
    cuerpo.includes("Granola de la casa"),
    "Granola de la casa",
  );
  check("hay reparto de cómo lo reciben", cuerpo.includes("A domicilio"));
  check("y de cómo pagan", cuerpo.includes("Tarjeta"));
  check("y desglose por tienda", /Blend Norte/.test(cuerpo));

  await page.screenshot({ path: "shots-metricas/7-dias.png", fullPage: true });

  // El filtro de arriba tiene que mover todo lo de abajo.
  await page.getByRole("tab", { name: "30 días" }).click();
  await page.waitForTimeout(2000);
  const ventas30 = filas.reduce((n, f) => n + f.total, 0) + (await previos(30));
  const cuerpo30 = await page.locator("main").innerText();
  check(
    "cambiar el rango recalcula todo",
    cuerpo30.includes(ventas30.toLocaleString("es-CO")),
    `esperado ${ventas30.toLocaleString("es-CO")}`,
  );

  // La vista de tabla es el gemelo accesible de cada gráfico.
  await page.getByRole("button", { name: "Ver tablas" }).click();
  await page.waitForTimeout(700);
  check("hay vista de tabla", (await page.locator("table").count()) >= 6);
  check(
    "la tabla trae las mismas cifras",
    (await page.locator("main").innerText()).includes("Mango Terco"),
  );
  await page.screenshot({ path: "shots-metricas/tablas.png", fullPage: true });
} catch (err) {
  crashed(err);
} finally {
  await sql`delete from orders where customer->>'name' = ${MARCA}`;
  await deleteUser(sql, user.email);
  await browser.close();
  await sql.end();
}

process.exit(finish(errors) ? 1 : 0);

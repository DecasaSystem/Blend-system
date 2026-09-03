/**
 * Prueba de lo que el equipo puede personalizar desde /equipo y que antes
 * estaba clavado en el código: la foto del carrusel, su fondo, los tamaños,
 * los adicionales y el domicilio.
 *
 * Cierra con lo que más importa: que un precio manipulado en el navegador no
 * llegue a cobrarse.
 *
 *   node --env-file=.env.local scripts/personalizar-flow.mjs [url]
 */
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];

/** Un PNG naranja de 1×1. Sirve de foto sin depender de la red. */
const FOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const user = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

const publish = async (page) => {
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.getByText("Publicado. La tienda ya lo muestra.").waitFor({ timeout: 30000 });
};

try {
  await sql`delete from site_content`;

  const admin = await ctx.newPage();
  await login(admin, URL, user);
  await admin.getByRole("tab", { name: /Contenido/ }).click();
  await admin.waitForTimeout(600);

  // ── El carrusel: foto principal y fondo ──────────────────────────────────
  await admin.getByRole("button", { name: "Carrusel" }).click();
  await admin.locator("details").first().locator("summary").click();

  const principal = admin.getByPlaceholder("Pega la URL de la foto").first();
  check("hay campo para la foto principal", await principal.isVisible());
  await principal.fill(FOTO);

  const fondo = admin.getByPlaceholder("Pega la URL del video o la foto").first();
  check("hay campo para el fondo", await fondo.isVisible());
  await fondo.fill(FOTO);

  const slider = admin.locator('input[type="range"]').first();
  check("aparece el control del fondo al poner una", await slider.isVisible());
  await slider.fill("25");

  await publish(admin);

  const tienda = await ctx.newPage();
  await tienda.goto(URL, { waitUntil: "networkidle" });

  const hero = tienda.locator("#top");
  const foto = hero.locator(`img[src="${FOTO}"]`);
  check("la foto principal reemplaza al vaso dibujado", (await foto.count()) >= 1);
  check("el vaso ilustrado desaparece", (await hero.locator('svg[role="img"]').count()) === 0);

  const opacidad = await hero
    .locator("img")
    .first()
    .evaluate((el) => el.style.opacity);
  check("el fondo respeta la opacidad elegida", opacidad === "0.25", `opacity=${opacidad}`);

  // ── Las bebidas del día también se personalizan ──────────────────────────
  // Contenido de fábrica: Mango Terco a 17.900 el chico y 22.400 el grande,
  // con precio del día de 14.900 sobre el chico. La rebaja es la misma en los
  // dos vasos, así que el grande del día sale a 19.400. Granola +4.500.
  // Acotado a la sección: la misma bebida sale también en el menú de abajo.
  await tienda
    .locator("#del-dia")
    .getByRole("button", { name: /Personalizar Mango Terco/ })
    .click();
  const hojaDia = tienda.getByRole("dialog");
  check("la bebida del día abre la hoja", await hojaDia.isVisible());
  check(
    "la hoja avisa que lleva precio del día",
    await hojaDia.getByText("Precio del día").isVisible(),
  );
  check(
    "y muestra el precio de lista tachado",
    await hojaDia
      .getByText(/\$\s*17\.900/)
      .first()
      .isVisible(),
  );

  await hojaDia.getByRole("button", { name: /Grande/ }).click();
  await hojaDia.getByRole("button", { name: /Granola de la casa/ }).click();
  const botonDia = await hojaDia.getByRole("button", { name: /Agregar ·/ }).innerText();
  check(
    "personalizar parte del precio del día, no del de lista",
    botonDia.includes("23.900"),
    botonDia.replace(/\s+/g, " "),
  );
  await hojaDia.getByRole("button", { name: /Agregar ·/ }).click();
  await tienda.waitForTimeout(400);

  // Y el servidor tiene que seguir reconociéndola como oferta al cobrar.
  await tienda.goto(`${URL}/checkout`, { waitUntil: "networkidle" });
  check(
    "en el carrito conserva la etiqueta de oferta",
    await tienda.getByText("Precio del día").first().isVisible(),
  );
  await tienda.evaluate(() => localStorage.removeItem("blend.cart.v2"));

  // ── Precios y adicionales ────────────────────────────────────────────────
  await admin.getByRole("button", { name: "Precios y adicionales" }).click();
  await admin.waitForTimeout(300);

  // Cada bloque tiene sus propios "Nombre" y "Precio": hay que acotar.
  const bloque = (titulo) => admin.locator(`details:has(summary:has-text("${titulo}"))`);

  // Un adicional nuevo, con nombre reconocible.
  await admin.getByRole("button", { name: "+ Añadir adicional" }).click();
  await bloque("Adicionales").getByLabel("Nombre").last().fill("Miel de café");
  await bloque("Adicionales").getByLabel("Precio", { exact: true }).last().fill("9100");

  // Y el domicilio.
  await admin.getByLabel("Costo del domicilio").fill("12400");
  await publish(admin);

  // El precio del vaso grande de Mango Terco, que ahora vive en la bebida y no
  // en un recargo global: 22.400 -> 25.200.
  await admin.getByRole("button", { name: "Menú" }).click();
  await admin.waitForTimeout(400);
  const bebida = admin.locator('details:has(summary:has-text("Mango Terco"))');
  await bebida.locator("summary").click();
  await admin.waitForTimeout(300);
  await bebida.getByLabel("Grande · 500 ml").fill("25200");
  await publish(admin);

  await tienda.goto(URL, { waitUntil: "networkidle" });
  // Ésta a precio de lista, la del menú: la del día tiene su propio bloque arriba.
  await tienda
    .locator("#menu")
    .getByRole("button", { name: /Personalizar Mango Terco/ })
    .click();
  const hoja = tienda.getByRole("dialog");
  check("el adicional nuevo se ofrece", await hoja.getByText("Miel de café").isVisible());
  check(
    "con su precio",
    await hoja
      .getByText(/\+\s*\$\s*9\.100/)
      .first()
      .isVisible(),
  );
  // Cada vaso enseña su precio, no un recargo.
  check(
    "cada vaso enseña su propio precio",
    await hoja
      .getByText(/\$\s*25\.200/)
      .first()
      .isVisible(),
  );
  check(
    "y el chico sigue en el suyo",
    await hoja
      .getByText(/\$\s*17\.900/)
      .first()
      .isVisible(),
  );

  await hoja.getByRole("button", { name: /Grande/ }).click();
  await hoja.getByRole("button", { name: /Miel de café/ }).click();
  // 25.200 del vaso grande + 9.100 del adicional
  const boton = await hoja.getByRole("button", { name: /Agregar ·/ }).innerText();
  check("suma bien en la hoja", boton.includes("34.300"), boton.replace(/\s+/g, " "));
  await hoja.getByRole("button", { name: /Agregar ·/ }).click();

  await tienda.goto(`${URL}/checkout`, { waitUntil: "networkidle" });
  check(
    "el checkout cobra el domicilio nuevo",
    await tienda
      .getByText(/\$\s*12\.400/)
      .first()
      .isVisible(),
  );

  // ── Un precio manipulado no se cobra ─────────────────────────────────────
  await tienda.evaluate(() => {
    const key = "blend.cart.v2";
    const saved = JSON.parse(localStorage.getItem(key));
    saved.lines = saved.lines.map((l) => ({ ...l, unitPrice: 100, basePrice: 100 }));
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await tienda.reload({ waitUntil: "networkidle" });
  check(
    "el navegador se cree el precio falso",
    await tienda
      .getByText(/^\$\s*100$/)
      .first()
      .isVisible(),
  );

  await tienda.getByLabel("Nombre").fill("Prueba Manipulada");
  await tienda.getByLabel("Teléfono").fill("310 000 0000");
  await tienda.getByLabel("Dirección").fill("Cra. 14 #12-40");
  await tienda.getByRole("button", { name: /Enviar el pedido|Pagar/ }).click();

  const aviso = tienda.getByRole("alert");
  await aviso.waitFor({ timeout: 20000 }).catch(() => {});
  check("el servidor rechaza el precio manipulado", await aviso.isVisible());

  const [colado] = await sql`
    select total from orders where customer->>'name' = 'Prueba Manipulada'
  `;
  check(
    "y no queda ningún pedido barato en la base",
    !colado,
    colado ? `total=${colado.total}` : "",
  );
} catch (err) {
  crashed(err);
} finally {
  await sql`delete from site_content`;
  await sql`delete from orders where customer->>'name' = 'Prueba Manipulada'`;
  await deleteUser(sql, user.email);
  await browser.close();
  await sql.end();
}

process.exit(finish(errors) ? 1 : 0);

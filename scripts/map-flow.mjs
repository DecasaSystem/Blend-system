/**
 * Prueba del mapa de tiendas: carga diferida, pines, selección y respaldo.
 *   node scripts/map-flow.mjs [url]
 */
import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";

const browser = await chromium.launch({ executablePath: CHROME });

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

// --- Con red: el mapa real carga ---
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const tileRequests = [];
page.on("request", (r) => {
  if (/openfreemap|tiles?\./i.test(r.url())) tileRequests.push(r.url());
});

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
check("no descarga el mapa antes de verlo", tileRequests.length === 0, `${tileRequests.length}`);

await page.locator("#tiendas").scrollIntoViewIfNeeded();
// Los pines sólo existen cuando el estilo terminó de cargar: esperar por ellos
// en vez de por un tiempo fijo, que con la red lenta se queda corto.
const pins = page.locator(".blend-pin");
await pins.first().waitFor({ timeout: 45000 });
check(
  "el mapa real carga al llegar a la sección",
  tileRequests.length > 0,
  `${tileRequests.length} peticiones`,
);

check("dibuja un pin por sede", (await pins.count()) === 2, `${await pins.count()}`);

const active = page.locator('.blend-pin[data-active="true"]');
check("una sede arranca seleccionada", (await active.count()) === 1);

// Seleccionar la otra desde el mapa
await pins.nth(1).click();
await page.waitForTimeout(900);
const label = await page.locator('.blend-pin[data-active="true"] .blend-pin-label').innerText();
const cardName = await page.locator("#tiendas").getByText("Seleccionada").locator("..").innerText();
// El CSS pone la etiqueta del pin en mayúsculas; la tarjeta no.
check(
  "tocar un pin cambia la tarjeta",
  cardName.toLowerCase().includes(label.toLowerCase()),
  `${label} · ${cardName.split("\n")[1] ?? cardName.slice(0, 40)}`,
);

// Elegir la otra desde la lista mueve el pin activo de vuelta
await page.locator("[data-store-list] button", { hasText: "Norte" }).first().click();
await page.waitForTimeout(900);
const label2 = await page.locator('.blend-pin[data-active="true"] .blend-pin-label').innerText();
check("elegir en la lista mueve el pin activo", /norte/i.test(label2), label2);

// Atribución visible
const attrib = await page.locator(".maplibregl-ctrl-attrib").count();
check("mantiene la atribución del mapa", attrib > 0);

// Sin scroll atrapado: la rueda sobre el mapa desplaza la página
const before = await page.evaluate(() => window.scrollY);
await page.mouse.move(500, 500);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(600);
const after = await page.evaluate(() => window.scrollY);
check("la rueda sobre el mapa desplaza la página", after > before, `${before} → ${after}`);

await ctx.close();

// --- Sin red: el mapa ilustrado toma el relevo ---
const offlineCtx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  locale: "es-CO",
});
const offline = await offlineCtx.newPage();
await offline.route("**://tiles.openfreemap.org/**", (r) => r.abort());
await offline.goto(URL, { waitUntil: "domcontentloaded" });
await offline.locator("#tiendas").scrollIntoViewIfNeeded();
await offline.waitForTimeout(6000);

const fallbackVisible = await offline
  .locator("#tiendas")
  .getByRole("img", { name: "Mapa de las tiendas" })
  .isVisible();
check("sin teselas se ve el mapa ilustrado", fallbackVisible);

const notice = await offline.getByText(/sin conexión/i).isVisible();
check("avisa que está en modo ilustrado", notice);

const svgPins = await offline.locator('#tiendas [role="button"][aria-label^="Ver Blend"]').count();
check("el respaldo conserva los pines", svgPins === 2, `${svgPins}`);

// Con el mapa real activo, el ilustrado no debe quedar navegable por teclado
await ctx2Check();

async function ctx2Check() {
  const c = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
  const q = await c.newPage();
  await q.goto(URL, { waitUntil: "domcontentloaded" });
  await q.locator("#tiendas").scrollIntoViewIfNeeded();
  await q.waitForSelector(".blend-pin", { timeout: 30000 });
  await q.waitForTimeout(1200);
  const ghosts = await q.locator('#tiendas [role="button"][aria-label^="Ver Blend"]').count();
  check("el mapa ilustrado deja de ser navegable", ghosts === 0, `${ghosts} pines fantasma`);
  await c.close();
}

await offlineCtx.close();
await browser.close();

console.log(
  errors.length
    ? `\nERRORES DE CONSOLA:\n${errors.slice(0, 5).join("\n")}`
    : "\nsin errores de consola",
);
console.log(failures ? `\n${failures} fallas` : "\ntodo pasa");
process.exit(failures ? 1 : 0);

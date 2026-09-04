/** Capturas del editor de contenido. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots-editor";
const PASS = "blend2026";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });

for (const d of [
  { name: "movil", width: 390, height: 844, mobile: true },
  { name: "escritorio", width: 1440, height: 950, mobile: false },
]) {
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: 2,
    isMobile: d.mobile,
    hasTouch: d.mobile,
    locale: "es-CO",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Clave de la tienda").fill(PASS);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("tab", { name: /Contenido/ }).click();
  await page.waitForTimeout(400);

  // Carrusel con un slide abierto
  await page.locator("details").first().locator("summary").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${d.name}-carrusel.png` });

  // Menú con un producto abierto
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .locator("details")
    .filter({ hasText: "Mango Terco" })
    .first()
    .locator("summary")
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${d.name}-producto.png` });

  // Del día
  await page.getByRole("button", { name: "Del día" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${d.name}-dia.png` });

  await ctx.close();
}

await browser.close();
console.log("Listo →", OUT);

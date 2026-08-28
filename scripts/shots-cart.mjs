/** Capturas del flujo de pedido: hoja, carrito y resumen de pago. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots-cart";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });

for (const d of [
  { name: "movil", width: 390, height: 844, mobile: true },
  { name: "escritorio", width: 1440, height: 900, mobile: false },
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
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  const card = page.locator("#menu article").first();
  await card.getByRole("button", { name: /Agregar .* al pedido/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${d.name}-aviso.png` });

  await card.locator("h3").click();
  await page.waitForTimeout(600);
  const sheet = page.getByRole("dialog").first();
  await sheet.getByRole("button", { name: /^Grande/ }).click();
  await sheet.getByRole("button", { name: /Cacao nibs/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${d.name}-hoja.png` });
  await sheet.getByRole("button", { name: /^Agregar ·/ }).click();
  await page.waitForTimeout(600);

  await page
    .locator("header")
    .getByRole("button", { name: /Abrir carrito/ })
    .click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${d.name}-carrito.png` });

  await page.goto(`${URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${d.name}-checkout.png`, fullPage: true });

  await ctx.close();
}

await browser.close();
console.log("Listo →", OUT);

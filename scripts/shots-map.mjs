/** Capturas del mapa de tiendas. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots-map";
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
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.locator("#tiendas").scrollIntoViewIfNeeded();
  await page.waitForSelector(".blend-pin", { timeout: 30000 });
  // Dar tiempo a que entren las teselas
  await page.waitForTimeout(6000);
  await page.locator("#tiendas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${d.name}-tiendas.png` });
  await ctx.close();
}

await browser.close();
console.log("Listo →", OUT);

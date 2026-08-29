/** Captura la pantalla de entrar, con el botón de Google si está configurado. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { CHROME } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots-google";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });

for (const d of [
  { name: "movil", width: 390, height: 900, mobile: true },
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
  await page.goto(`${URL}/cuenta/entrar`, { waitUntil: "networkidle" });
  // El botón lo dibuja Google en un iframe: hay que darle un momento.
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${d.name}.png`, fullPage: true });

  const drawn = await page.locator("[data-google-slot] iframe").count();
  console.log(`${d.name}: ${drawn > 0 ? "Google dibujó su botón" : "sin botón de Google"}`);
  await ctx.close();
}

await browser.close();
console.log("Listo →", OUT);

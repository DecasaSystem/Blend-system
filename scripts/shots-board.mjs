/** Capturas del tablero de la barra. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots-board";
const PASS = "blend2026";
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

  await page.goto(`${URL}/equipo`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${d.name}-acceso.png` });

  await page.getByLabel("Clave de la tienda").fill(PASS);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForTimeout(600);

  // Unos cuantos pedidos repartidos por los estados
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Pedido de prueba" }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);

  const advance = async (label, times) => {
    for (let i = 0; i < times; i++) {
      const btn = page.getByRole("button", { name: label }).first();
      if ((await btn.count()) === 0) break;
      await btn.click();
      await page.waitForTimeout(200);
    }
  };
  await advance("Empezar", 3);
  await advance("Marcar listo", 2);
  await advance("Marcar entregado", 1);
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${OUT}/${d.name}-tablero.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log("Listo →", OUT);

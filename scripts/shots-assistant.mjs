/**
 * Capturas del asistente, cerrado y abierto, en móvil y escritorio.
 *   node scripts/shots-assistant.mjs [url] [carpeta]
 * La ruta se intercepta: no gasta tokens.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { CHROME } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots";
mkdirSync(OUT, { recursive: true });

const ndjson = (events) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
const REPLIES = [
  "Si te gusta lo ácido, el Mango biche: mango verde, maracuyá y un toque de sal. $14.900 el chico. ¿Te abro la ficha?",
  "Estamos en dos sedes: Norte (Cra. 14 #25 Norte-2, 7:00 – 21:00) y Centro (8:00 – 20:00). Te llevé al mapa.",
];

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
  let n = 0;
  await ctx.route("**/api/asistente", async (route) => {
    const text = REPLIES[n++ % REPLIES.length];
    const events = text.split(" ").map((w) => ({ t: "delta", v: w + " " }));
    events.push({ t: "done" });
    await route.fulfill({ status: 200, headers: { "Content-Type": "application/x-ndjson" }, body: ndjson(events) });
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // La invitación sale a los 2,5 s.
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${OUT}/${d.name}-asistente-cerrado.png` });

  await page.getByRole("button", { name: "Abrir el chat" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${d.name}-asistente-vacio.png` });

  const input = page.getByPlaceholder("Pregúntame lo que quieras…");
  await input.fill("Quiero algo ácido y frío, ¿qué me recomiendas?");
  await input.press("Enter");
  await page.waitForTimeout(800);
  await input.fill("¿Dónde están?");
  await input.press("Enter");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${d.name}-asistente-charla.png` });
  await ctx.close();
}

await browser.close();
console.log("Listo →", OUT);

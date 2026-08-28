/**
 * Capturas de revisión. Usa el Chrome instalado, no descarga navegadores.
 *   node scripts/shots.mjs [url] [carpeta]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DEVICES = [
  { name: "movil-390", width: 390, height: 844, dsf: 2, mobile: true },
  { name: "movil-360", width: 360, height: 780, dsf: 2, mobile: true },
  { name: "tablet-820", width: 820, height: 1180, dsf: 2, mobile: true },
  { name: "escritorio-1440", width: 1440, height: 900, dsf: 1, mobile: false },
];

const SECTIONS = ["top", "del-dia", "menu", "constructor", "tiendas", "contacto"];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });

for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: d.dsf,
    isMobile: d.mobile,
    hasTouch: d.mobile,
    locale: "es-MX",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Desbordamiento horizontal
  const overflow = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const wide = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > docW + 1 || r.left < -1)) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.position === "absolute") continue;
        wide.push(
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.left)}..${Math.round(r.right)} (doc ${docW})`,
        );
      }
    }
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: docW,
      offenders: wide.slice(0, 8),
    };
  });

  // Objetivos táctiles pequeños
  const small = d.mobile
    ? await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll("button, a, [role=button], input, select")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.height < 40 || r.width < 24) {
            bad.push(
              `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 26)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
            );
          }
        }
        return bad.slice(0, 12);
      })
    : [];

  console.log(`\n=== ${d.name} (${d.width}px) ===`);
  console.log(`scrollWidth ${overflow.scrollW} / clientWidth ${overflow.clientW}`);
  if (overflow.offenders.length) console.log("DESBORDA:", overflow.offenders);
  if (small.length) console.log("TÁCTIL <40px:", small);
  if (errors.length) console.log("ERRORES:", errors.slice(0, 5));

  await page.screenshot({ path: `${OUT}/${d.name}-completa.png`, fullPage: true });

  for (const id of SECTIONS) {
    const el = await page.$(`#${id}`);
    if (!el) continue;
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${d.name}-${id}.png` });
  }

  await ctx.close();
}

await browser.close();
console.log("\nListo →", OUT);

import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SEL = process.argv[3] ?? "#tiendas";

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const page = await ctx.newPage();
await page.goto(process.argv[2] ?? "http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const report = await page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return "no encontrado";
  const lines = [`ROOT offset=${root.offsetWidth} scroll=${root.scrollWidth}`];
  const walk = (el, depth) => {
    for (const c of el.children) {
      const r = c.getBoundingClientRect();
      const over = c.scrollWidth > c.offsetWidth + 1 || r.right > 391;
      if (over) {
        lines.push(
          `${"  ".repeat(depth)}${c.tagName.toLowerCase()}[${String(c.className).slice(0, 55)}] off=${c.offsetWidth} scroll=${c.scrollWidth} right=${Math.round(r.right)} text="${(c.textContent || "").trim().slice(0, 30)}"`,
        );
        walk(c, depth + 1);
      }
    }
  };
  walk(root, 0);
  return lines.join("\n");
}, SEL);

console.log(report);
await browser.close();

/** Capturas de las pantallas de cuenta de cliente. */
import { randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { CHROME, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "shots-account";
mkdirSync(OUT, { recursive: true });

const sql = sqlClient();
const password = randomBytes(12).toString("base64url");
// Una cuenta por tamaño de pantalla: reutilizar el mismo correo hacía fallar
// el segundo registro y complicaba el script sin necesidad.
const emails = [];

const browser = await chromium.launch({ executablePath: CHROME });

try {
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
    const email = `demo-${randomBytes(4).toString("hex")}@blend.test`;
    emails.push(email);

    await page.goto(`${URL}/cuenta/registro`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${d.name}-registro.png`, fullPage: true });

    await page.getByLabel("Nombre").fill("Camila Ruiz");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Teléfono").fill("310 123 4567");
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL(`${URL}/cuenta`, { timeout: 25000 });

    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${d.name}-cuenta.png`, fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
  if (emails.length) await sql`delete from customers where email in ${sql(emails)}`;
  await sql.end({ timeout: 5 });
}

console.log("Listo →", OUT);

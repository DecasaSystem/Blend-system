/**
 * Prueba la subida de fotos a Cloudinary desde el editor.
 *
 * Sube de verdad a la cuenta configurada y borra lo subido al terminar, así que
 * no deja basura. Comprueba las tres cosas que importan: que el archivo llega a
 * Cloudinary, que en la base queda la URL (y no la foto entera), y que la
 * tienda la pide con las transformaciones de tamaño y formato.
 *
 *   node --env-file=.env.local scripts/media-flow.mjs [url]
 */
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { CHROME, createTempUser, deleteUser, login, reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const sql = sqlClient();
const { check, crashed, finish } = reporter();
const errors = [];
const subidas = [];

/** Un PNG de 2×2 de verdad, para que Cloudinary tenga algo que procesar. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYGJAQ0AABYCAQEXvRJoAAAAAElFTkSuQmCC",
  "base64",
);
const dir = mkdtempSync(join(tmpdir(), "blend-media-"));
const archivo = join(dir, "foto-de-prueba.png");
writeFileSync(archivo, PNG);

/** Borra de Cloudinary lo que subió la prueba. */
async function limpiar(url) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return;

  // De la URL sale el public_id: lo que hay entre la versión y la extensión.
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  if (!m) return;
  const publicId = m[1];
  const timestamp = Math.floor(Date.now() / 1000);
  const firma = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${secret}`, "utf8")
    .digest("hex");

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", key);
  form.append("signature", firma);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
    method: "POST",
    body: form,
  });
  const body = await res.json();
  console.log(`   limpieza de ${publicId}: ${body.result ?? "sin respuesta"}`);
}

const user = await createTempUser(sql, { role: "admin" });
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "es-CO" });
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});

try {
  await sql`delete from site_content`;

  const admin = await ctx.newPage();
  await login(admin, URL, user);
  await admin.getByRole("tab", { name: /Contenido/ }).click();
  await admin.waitForTimeout(600);
  await admin.getByRole("button", { name: "Carrusel" }).click();
  await admin.locator("details").first().locator("summary").click();

  const campo = admin.getByPlaceholder("Pega la URL de la foto").first();
  const boton = admin.getByRole("button", { name: "Subir foto" }).first();
  check("el editor ofrece subir", await boton.isVisible());

  // El input de archivo está oculto: se le pasa el archivo directamente.
  await admin.locator('input[type="file"]').first().setInputFiles(archivo);

  await admin.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("input")).some((i) =>
        i.value.startsWith("https://res.cloudinary.com/"),
      ),
    { timeout: 60000 },
  );

  const url = await campo.inputValue();
  subidas.push(url);
  check("la foto sube a Cloudinary", url.startsWith("https://res.cloudinary.com/"), url);
  check("queda en la carpeta blend/", url.includes("/blend/"));

  // Cloudinary tiene que servirla de verdad, no sólo devolver una URL.
  const directa = await fetch(url);
  check("Cloudinary la entrega", directa.ok, `HTTP ${directa.status}`);

  await admin.getByRole("button", { name: "Publicar" }).click();
  await admin.getByText("Publicado. La tienda ya lo muestra.").waitFor({ timeout: 30000 });

  const [fila] = await sql`select data from site_content`;
  const guardado = fila.data.slides[0].art;
  check("en la base queda la URL, no la foto", guardado === url);
  check(
    "no se guardó ningún data URL",
    !JSON.stringify(fila.data).includes("data:image/"),
    `${Math.round(JSON.stringify(fila.data).length / 1024)} KB en total`,
  );

  const tienda = await ctx.newPage();
  await tienda.goto(URL, { waitUntil: "networkidle" });
  const img = tienda.locator("#top img").first();
  const src = await img.getAttribute("src");
  check("la tienda pide formato automático", src.includes("f_auto"), src);
  check("y calidad automática", src.includes("q_auto"));
  check("y al ancho que se ve, no al original", src.includes("w_800"));

  const srcset = await img.getAttribute("srcset");
  check("ofrece versión 2x para pantallas retina", Boolean(srcset?.includes("w_1600")));

  const entregada = await fetch(src);
  check(
    "la versión transformada carga",
    entregada.ok,
    `HTTP ${entregada.status} · ${entregada.headers.get("content-type")}`,
  );
} catch (err) {
  crashed(err);
} finally {
  for (const u of subidas) await limpiar(u);
  await sql`delete from site_content`;
  await deleteUser(sql, user.email);
  await browser.close();
  await sql.end();
}

process.exit(finish(errors) ? 1 : 0);

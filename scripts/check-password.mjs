/**
 * Comprueba si una contraseña coincide con la guardada, sin pasar por el
 * navegador. Sirve para saber si el problema está en la contraseña o en el
 * login.
 *
 *   node --env-file=.env.local scripts/check-password.mjs correo@ejemplo.com
 */
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { askHidden } from "./lib/ask.mjs";

const scryptAsync = promisify(scrypt);
const email = process.argv[2];

if (!email) {
  console.error("Uso: node --env-file=.env.local scripts/check-password.mjs correo@ejemplo.com");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [user] = await sql`
    select email, password_hash from users where lower(email) = ${email.toLowerCase()}
  `;

  if (!user) {
    console.log(`No hay ninguna cuenta de equipo con ${email}.`);
    process.exit(1);
  }

  const [scheme, saltHex, keyHex] = String(user.password_hash).split(":");
  console.log(`Cuenta: ${user.email}`);
  console.log(`Formato del hash: ${scheme} · sal ${saltHex?.length ?? 0} · clave ${keyHex?.length ?? 0}`);

  if (scheme !== "scrypt" || !saltHex || !keyHex) {
    console.log("\nEl hash guardado está mal formado. Vuelve a crear la cuenta.");
    process.exit(1);
  }

  const password = await askHidden("Contraseña a probar: ");
  console.log(`Longitud de lo que escribiste: ${password.length} caracteres`);

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length);
  const ok = actual.length === expected.length && timingSafeEqual(actual, expected);

  console.log(ok ? "\nCOINCIDE. La contraseña guardada es esa." : "\nNO COINCIDE con la guardada.");
} catch (err) {
  console.error("Error:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

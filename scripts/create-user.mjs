/**
 * Crea o actualiza un usuario de la barra.
 *
 *   node --env-file=.env.local scripts/create-user.mjs correo@blend.cafe "Nombre" admin
 *
 * La contraseña se pide por teclado y no queda en el historial de la terminal
 * ni en ningún archivo: sólo se guarda su hash.
 */
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { askHidden } from "./lib/ask.mjs";

const scryptAsync = promisify(scrypt);

const [email, name, role = "barra"] = process.argv.slice(2);

if (!email || !name) {
  console.error(
    'Uso: node --env-file=.env.local scripts/create-user.mjs correo "Nombre" [admin|barra]',
  );
  process.exit(1);
}
if (!["admin", "barra"].includes(role)) {
  console.error("El rol debe ser admin o barra.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const password = await askHidden("Contraseña: ");
const again = await askHidden("Repítela: ");

if (password !== again) {
  console.error("No coinciden.");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Necesita al menos 10 caracteres.");
  process.exit(1);
}

// La longitud sirve para cazar un problema concreto: si aquí sale un número
// distinto del que crees haber escrito, la terminal se comió alguna tecla y
// estarías guardando una contraseña que en el navegador nunca vas a poder
// teclear igual.
console.log(`Longitud de la contraseña: ${password.length} caracteres`);

const salt = randomBytes(16);
const key = await scryptAsync(password.normalize("NFKC"), salt, 64);
const passwordHash = `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [row] = await sql`
    insert into users (id, email, name, password_hash, role)
    values (${randomUUID()}, ${email.toLowerCase()}, ${name}, ${passwordHash}, ${role})
    on conflict (lower(email)) do update
      set name = excluded.name,
          password_hash = excluded.password_hash,
          role = excluded.role
    returning email, name, role
  `;
  console.log(`Listo: ${row.name} <${row.email}> como ${row.role}`);
} catch (err) {
  console.error("No se pudo guardar:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

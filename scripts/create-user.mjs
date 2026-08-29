/**
 * Crea o actualiza un usuario de la barra.
 *
 *   node --env-file=.env.local scripts/create-user.mjs correo@blend.cafe "Nombre" admin
 *
 * La contraseña se pide por teclado y no queda en el historial de la terminal
 * ni en ningún archivo: sólo se guarda su hash.
 */
import { createInterface } from "node:readline/promises";
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { stdin, stdout } from "node:process";
import postgres from "postgres";

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

/** Lee sin mostrar lo que se teclea. */
async function askHidden(question) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const onData = (char) => {
    if (["\n", "\r", ""].includes(String(char))) return;
    stdout.write("\x1B[2K\x1B[200D" + question);
  };
  stdin.on("data", onData);
  const answer = await rl.question(question);
  stdin.off("data", onData);
  rl.close();
  stdout.write("\n");
  return answer;
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

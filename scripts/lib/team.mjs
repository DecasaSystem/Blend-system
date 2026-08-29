/** Ayudas compartidas por las pruebas que necesitan sesión de equipo. */
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const scryptAsync = promisify(scrypt);

export const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export function sqlClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL. Corre con --env-file=.env.local");
  }
  return postgres(process.env.DATABASE_URL, { max: 1 });
}

async function hash(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

/** Usuario desechable para la prueba. Se borra al terminar. */
export async function createTempUser(sql, { role = "admin" } = {}) {
  const email = `prueba-${randomUUID().slice(0, 8)}@blend.test`;
  const password = randomBytes(18).toString("base64url");
  await sql`
    insert into users (id, email, name, password_hash, role)
    values (${randomUUID()}, ${email}, ${"Prueba"}, ${await hash(password)}, ${role})
  `;
  return { email, password };
}

export async function deleteUser(sql, email) {
  await sql`delete from users where email = ${email}`;
}

/**
 * Entra por la pantalla de login, como una persona.
 * El margen es amplio a propósito: en desarrollo la primera visita a /equipo
 * compila la ruta y puede tardar bastante más que una carga normal.
 */
export async function login(page, url, user) {
  await page.goto(`${url}/equipo/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${url}/equipo`, { timeout: 60000 });
}

export function reporter() {
  const state = { failures: 0 };
  return {
    check(name, ok, extra = "") {
      console.log(`${ok ? "ok  " : "FALLA"} ${name}${extra ? ` — ${extra}` : ""}`);
      if (!ok) state.failures++;
    },
    /** Una excepción cuenta como falla: si no, el `finally` la taparía. */
    crashed(err) {
      state.failures++;
      console.log(`FALLA (excepción) ${err?.message ?? err}`);
    },
    finish(errors = []) {
      console.log(
        errors.length
          ? `\nERRORES DE CONSOLA:\n${errors.slice(0, 5).join("\n")}`
          : "\nsin errores de consola",
      );
      console.log(state.failures ? `\n${state.failures} fallas` : "\ntodo pasa");
      return state.failures;
    },
  };
}

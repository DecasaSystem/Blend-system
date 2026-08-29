import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hash de contraseñas con scrypt.
 *
 * scrypt viene en Node: sin dependencias que compilar ni que auditar, y está
 * pensado justo para esto — es caro en memoria, así que atacarlo con GPU sale
 * mucho más lento que con hashes de propósito general.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  // Comparación de tiempo constante: comparar con === filtra información
  // sobre cuántos bytes coinciden.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Reglas mínimas. No pedimos símbolos raros: la longitud es lo que importa. */
export function checkPasswordStrength(password: string): string | null {
  if (password.length < 10) return "La contraseña necesita al menos 10 caracteres.";
  if (/^\d+$/.test(password)) return "No uses sólo números.";
  return null;
}

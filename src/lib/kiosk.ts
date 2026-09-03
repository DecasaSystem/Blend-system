import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { kioskSessions, settings, KIOSK_PASSWORD } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

/**
 * Quiosco: la pantalla de autopedido del mostrador.
 *
 * Es su propio mundo de permisos. Una tablet desbloqueada puede hacer una cosa
 * —mandar un pedido a la barra de su sede— y ninguna más: no ve el tablero, ni
 * el editor, ni las cuentas. Por eso la sesión no reutiliza la del equipo.
 *
 * La clave se guarda hasheada en `settings`, no en `site_content`: ese objeto
 * viaja entero al navegador con cada visita a la tienda.
 */

const COOKIE = "blend_kiosk";
/** Una tablet de mostrador no debería tener que reautenticarse cada semana. */
const DURATION_DAYS = 90;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type KioskSession = { id: string; storeId: string; label: string };

/** Si no hay clave puesta, el quiosco no existe: no se puede entrar. */
export async function kioskConfigured() {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, KIOSK_PASSWORD))
    .limit(1);
  return Boolean(row?.value);
}

export async function setKioskPassword(password: string, by: string) {
  const value = await hashPassword(password);
  await db
    .insert(settings)
    .values({ key: KIOSK_PASSWORD, value, updatedBy: by })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date(), updatedBy: by },
    });
}

/** Quita la clave y desconecta todas las pantallas de golpe. */
export async function clearKioskPassword() {
  await db.delete(settings).where(eq(settings.key, KIOSK_PASSWORD));
  await db.delete(kioskSessions);
}

export async function checkKioskPassword(password: string) {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, KIOSK_PASSWORD))
    .limit(1);
  // Se verifica igual sin clave puesta, para que el tiempo de respuesta no
  // delate si el quiosco está configurado o no. El `await` no es opcional: sin
  // él se compararía una promesa, que siempre es verdadera, y entraría
  // cualquiera.
  const ok = await verifyPassword(password, row?.value ?? "scrypt:00:00");
  return ok && Boolean(row?.value);
}

export async function createKioskSession(storeId: string, label: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(kioskSessions).values({
    id: hashToken(token),
    storeId,
    label: label.trim().slice(0, 80) || "Pantalla sin nombre",
    expiresAt,
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await db.delete(kioskSessions).where(lt(kioskSessions.expiresAt, new Date()));
}

/** La pantalla de la petición actual, o null. */
export async function getKioskSession(): Promise<KioskSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: kioskSessions.id,
      storeId: kioskSessions.storeId,
      label: kioskSessions.label,
    })
    .from(kioskSessions)
    .where(and(eq(kioskSessions.id, hashToken(token)), gt(kioskSessions.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}

export async function requireKiosk(): Promise<KioskSession> {
  const sesion = await getKioskSession();
  if (!sesion) throw new Error("Esta pantalla no está autorizada.");
  return sesion;
}

/** Para saber cuándo se usó por última vez cada pantalla. */
export async function touchKiosk(id: string) {
  await db.update(kioskSessions).set({ lastSeenAt: new Date() }).where(eq(kioskSessions.id, id));
}

export async function closeKioskSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(kioskSessions).where(eq(kioskSessions.id, hashToken(token)));
  jar.delete(COOKIE);
}

export const KIOSK_COOKIE = COOKIE;

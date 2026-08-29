"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

/**
 * Entrar y salir.
 *
 * El mensaje de error es siempre el mismo, diga lo que diga el fallo: si
 * distinguiéramos "no existe ese correo" de "contraseña incorrecta", cualquiera
 * podría averiguar qué correos tienen cuenta.
 */

export type SignInState = { error?: string };

/** Freno a la fuerza bruta. En memoria: se reinicia al reiniciar el servidor y
 *  no se comparte entre instancias, así que es un primer filtro, no la defensa
 *  definitiva. Con varias instancias esto se mueve a la base o a Redis. */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function throttle(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

function clearThrottle(key: string) {
  attempts.delete(key);
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${email}`;
  if (throttle(key)) {
    return { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  // Se verifica igual aunque no exista el usuario: si respondiéramos antes,
  // el tiempo de respuesta delataría qué correos están registrados.
  const fallback = "scrypt:00:00";
  const ok = await verifyPassword(password, user?.passwordHash ?? fallback);

  if (!user || !ok) return { error: "Correo o contraseña incorrectos." };

  clearThrottle(key);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  redirect("/equipo");
}

export async function signOut() {
  await destroySession();
  redirect("/equipo/login");
}

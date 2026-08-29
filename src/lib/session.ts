import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

/**
 * Sesiones.
 *
 * El navegador guarda un token opaco en una cookie `httpOnly`: no en
 * localStorage, donde cualquier script de la página podría leerlo. En la base
 * sólo queda el hash del token, así que ni con acceso a la tabla se puede
 * suplantar a nadie.
 *
 * Son sesiones con estado, no JWT: revocar una es borrar una fila.
 */

const COOKIE = "blend_session";
const DURATION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "barra";
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  // Aprovecha para limpiar lo caducado; no hace falta una tarea aparte.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** El usuario de la petición actual, o null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(COOKIE);
}

/** Para las acciones de servidor: o hay sesión, o se corta. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("No hay sesión iniciada.");
  return user;
}

export const SESSION_COOKIE = COOKIE;

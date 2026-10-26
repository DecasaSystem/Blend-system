import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { Role } from "@/lib/orders";

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
  role: Role;
};

const DURATION_MS = DURATION_DAYS * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DURATION_MS);

  const jar = await cookies();
  // Si en este navegador quedaba otra sesión, se cierra: no se acumulan
  // sesiones huérfanas y un token anterior deja de valer al entrar.
  const previous = jar.get(COOKIE)?.value;
  if (previous) await db.delete(sessions).where(eq(sessions.id, hashToken(previous)));

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  jar.set(COOKIE, token, cookieOptions(expiresAt));

  // Aprovecha para limpiar lo caducado; no hace falta una tarea aparte.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * El usuario de la petición actual, o null.
 *
 * La sesión se renueva sola mientras se usa: cuando le queda menos de la
 * mitad, vuelve a durar 14 días. Antes caducaba a los 14 días de entrar,
 * trabajara uno o no, y sacaba a la barra en mitad del turno. El tablero
 * consulta al servidor cada pocos segundos, así que una pantalla abierta
 * no caduca nunca; una olvidada, sí.
 *
 * Primero se escribe la cookie y sólo si se pudo se alarga en la base: al
 * renderizar una página no se pueden tocar cookies, y alargar sólo la base
 * dejaría una cookie que caduca antes que su sesión. Ya se renovará en la
 * siguiente acción de servidor.
 *
 * `cache`: el layout y la página la piden en la misma petición; una consulta.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt.getTime() - Date.now() < DURATION_MS / 2) {
    const expiresAt = new Date(Date.now() + DURATION_MS);
    try {
      jar.set(COOKIE, token, cookieOptions(expiresAt));
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    } catch {
      // Renderizando una página: se renueva en la próxima acción.
    }
  }

  const { expiresAt: _, ...user } = row;
  return user;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(COOKIE);
}

/**
 * Para las acciones de servidor: o hay sesión, o se vuelve a entrar.
 *
 * Si la sesión venció con la pantalla abierta, lanzar un error dejaba la
 * página rota (en producción, «Minified React error #441»). Redirigir al
 * login es lo que la persona necesita. La cookie vieja se borra antes: el
 * proxy sólo mira si existe y, si quedara, rebotaría de /equipo/login a
 * /equipo y de vuelta.
 *
 * Al renderizar una página no se pueden tocar cookies, y «basta redirigir»
 * no bastaba: con la sesión cerrada desde otro lado (contraseña cambiada,
 * «cerrar sesiones», cuenta borrada) la cookie quedaba y el navegador
 * entraba en ese bucle hasta borrar las cookies a mano. Ahí se pasa por
 * /equipo/caducada, que sí puede borrarla.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    try {
      (await cookies()).delete(COOKIE);
    } catch {
      redirect("/equipo/caducada");
    }
    redirect("/equipo/login");
  }
  return user;
}

/**
 * Borra la cookie si su sesión ya no vale; si vale, no la toca. Así
 * /equipo/caducada no sirve para cerrarle la sesión a nadie con un enlace.
 */
export async function clearStaleSession() {
  if (await getSessionUser()) return;
  (await cookies()).delete(COOKIE);
}

/**
 * Sólo quien atiende la tienda: barra o administrador. Un repartidor tiene
 * sesión, pero no debe ver el tablero completo, editar la página ni las
 * métricas; lo suyo está en `src/actions/delivery.ts`.
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "repartidor") throw new Error("Esta parte es sólo para la barra.");
  return user;
}

export const SESSION_COOKIE = COOKIE;

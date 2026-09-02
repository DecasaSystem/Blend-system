"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { checkPasswordStrength, hashPassword } from "@/lib/password";
import { requireUser, type SessionUser } from "@/lib/session";

/**
 * Cuentas del equipo, desde la web.
 *
 * Hasta ahora sólo existían `scripts/create-user.mjs` y `list-users.mjs`, que
 * hay que correr con la cadena de conexión a mano. Eso deja al equipo sin
 * forma de dar de alta a alguien un sábado por la tarde.
 *
 * Todo lo de aquí exige rol `admin`, comprobado en el servidor. Un usuario de
 * barra no puede crear cuentas ni ascenderse a sí mismo.
 */

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "barra";
  createdAt: number;
  lastLoginAt: number | null;
  /** Cuántas sesiones abiertas tiene ahora mismo. */
  sesiones: number;
};

async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Sólo un administrador puede gestionar cuentas.");
  return user;
}

export async function listTeam(): Promise<TeamMember[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      sesiones: sql<number>`(
        select count(*)::int from ${sessions}
        where ${sessions.userId} = ${users.id} and ${sessions.expiresAt} > now()
      )`,
    })
    .from(users)
    .orderBy(users.createdAt);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.getTime(),
    lastLoginAt: r.lastLoginAt?.getTime() ?? null,
  }));
}

export type TeamResult = { ok: true; mensaje: string } | { error: string };

/** Alta de una cuenta nueva. El correo es único, sin distinguir mayúsculas. */
export async function createMember(
  email: string,
  name: string,
  role: "admin" | "barra",
  password: string,
): Promise<TeamResult> {
  await requireAdmin();

  const correo = email.trim().toLowerCase();
  const nombre = name.trim();

  if (!correo.includes("@") || correo.length < 5) return { error: "Ese correo no parece válido." };
  if (!nombre) return { error: "Falta el nombre." };
  if (role !== "admin" && role !== "barra") return { error: "El rol no existe." };

  const flojo = checkPasswordStrength(password);
  if (flojo) return { error: flojo };

  const [existe] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${correo}`)
    .limit(1);
  if (existe) return { error: "Ya hay una cuenta con ese correo." };

  await db.insert(users).values({
    id: randomUUID(),
    email: correo,
    name: nombre.slice(0, 120),
    passwordHash: await hashPassword(password),
    role,
  });

  revalidatePath("/equipo");
  return { ok: true, mensaje: `Cuenta creada para ${correo}.` };
}

/**
 * Cambia la contraseña de alguien.
 *
 * Se cierran además todas sus sesiones: si se cambia porque la contraseña se
 * filtró, dejar abierta la sesión de quien la robó no arregla nada.
 */
export async function resetMemberPassword(id: string, password: string): Promise<TeamResult> {
  await requireAdmin();

  const flojo = checkPasswordStrength(password);
  if (flojo) return { error: flojo };

  const [miembro] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!miembro) return { error: "Esa cuenta ya no existe." };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, id));
  await db.delete(sessions).where(eq(sessions.userId, id));

  return {
    ok: true,
    mensaje: `Contraseña cambiada para ${miembro.email}. Tendrá que entrar de nuevo.`,
  };
}

export async function changeMemberRole(id: string, role: "admin" | "barra"): Promise<TeamResult> {
  const yo = await requireAdmin();
  if (role !== "admin" && role !== "barra") return { error: "El rol no existe." };

  // Quitarse a uno mismo el rol de admin deja el panel sin quien lo gestione
  // si además es el único; y aunque no lo sea, es casi siempre un descuido.
  if (id === yo.id && role !== "admin") {
    return { error: "No puedes quitarte a ti mismo el rol de administrador." };
  }

  if (role !== "admin") {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (n <= 1) return { error: "Tiene que quedar al menos un administrador." };
  }

  await db.update(users).set({ role }).where(eq(users.id, id));
  return { ok: true, mensaje: "Rol actualizado." };
}

/** Borra una cuenta y, en cascada, sus sesiones. */
export async function removeMember(id: string): Promise<TeamResult> {
  const yo = await requireAdmin();
  if (id === yo.id) return { error: "No puedes borrar tu propia cuenta." };

  const [miembro] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!miembro) return { error: "Esa cuenta ya no existe." };

  if (miembro.role === "admin") {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (n <= 1) return { error: "Tiene que quedar al menos un administrador." };
  }

  await db.delete(users).where(eq(users.id, id));
  return { ok: true, mensaje: `Cuenta de ${miembro.email} eliminada.` };
}

/** Cierra todas las sesiones de alguien sin tocar su contraseña. */
export async function signOutMember(id: string): Promise<TeamResult> {
  await requireAdmin();
  await db.delete(sessions).where(eq(sessions.userId, id));
  return { ok: true, mensaje: "Sesiones cerradas." };
}

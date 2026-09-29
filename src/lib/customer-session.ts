import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { customers, customerSessions } from "@/db/schema";

/**
 * Sesión de cliente.
 *
 * Cookie propia y tabla propia, separadas de las del equipo: entrar como
 * cliente no puede acercarte ni por error al tablero de pedidos.
 */

const COOKIE = "blend_customer";
const DURATION_DAYS = 60;

export type Customer = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createCustomerSession(customerId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(customerSessions).values({ id: hashToken(token), customerId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await db.delete(customerSessions).where(lt(customerSessions.expiresAt, new Date()));
}

/** El cliente de la cookie, o null si no hay o ya no vale. Si la base falla, lanza. */
async function lookupCustomer(): Promise<Customer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: customers.id,
      email: customers.email,
      name: customers.name,
      phone: customers.phone,
    })
    .from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(
      and(eq(customerSessions.id, hashToken(token)), gt(customerSessions.expiresAt, new Date())),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getCustomer(): Promise<Customer | null> {
  try {
    return await lookupCustomer();
  } catch {
    // Si la base no responde, la tienda sigue funcionando sin cuenta.
    return null;
  }
}

export async function destroyCustomerSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(customerSessions).where(eq(customerSessions.id, hashToken(token)));
  jar.delete(COOKIE);
}

/**
 * Para las acciones de servidor: o hay cliente, o se vuelve a entrar.
 *
 * Una sesión vencida con la página abierta ya no rompe la pantalla (en
 * producción salía «Minified React error #441»): se borra la cookie vieja,
 * para que el proxy no rebote entre /cuenta/entrar y /cuenta, y se manda a
 * entrar. Si lo que falla es la base, eso sí es un error y se lanza.
 */
export async function requireCustomer(): Promise<Customer> {
  const customer = await lookupCustomer();
  if (!customer) {
    try {
      (await cookies()).delete(COOKIE);
    } catch {
      // Al renderizar una página no se pueden tocar cookies; ahí basta redirigir.
    }
    redirect("/cuenta/entrar");
  }
  return customer;
}

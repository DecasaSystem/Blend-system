import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
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

export async function getCustomer(): Promise<Customer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
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

export async function requireCustomer(): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer) throw new Error("Inicia sesión para continuar.");
  return customer;
}

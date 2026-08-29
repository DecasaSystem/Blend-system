"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { addresses, customers, orders } from "@/db/schema";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/password";
import {
  createCustomerSession,
  destroyCustomerSession,
  getCustomer,
  requireCustomer,
} from "@/lib/customer-session";
import { verifyGoogleCredential, type GoogleProfile } from "@/lib/google";
import type { Order } from "@/lib/orders";

/** Cuentas de clientes: registro, entrada, direcciones y pedidos propios. */

export type AccountState = { error?: string };

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

function throttled(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

async function clientKey(email: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${ip}:${email}`;
}

export async function signUp(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) return { error: "Faltan datos por llenar." };
  if (!email.includes("@")) return { error: "Ese correo no parece válido." };

  const weak = checkPasswordStrength(password);
  if (weak) return { error: weak };

  const [existing] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`lower(${customers.email}) = ${email}`)
    .limit(1);

  // Aquí sí se puede decir que el correo ya está: quien se registra necesita
  // saberlo, y de todos modos lo averiguaría intentándolo.
  if (existing) return { error: "Ya hay una cuenta con ese correo. Entra con tu contraseña." };

  const id = randomUUID();
  await db.insert(customers).values({
    id,
    email,
    name: name.slice(0, 120),
    phone: phone.slice(0, 40) || null,
    passwordHash: await hashPassword(password),
  });

  await createCustomerSession(id);
  redirect("/cuenta");
}

export async function signIn(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };
  if (throttled(await clientKey(email))) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.email}) = ${email}`)
    .limit(1);

  // Se verifica aunque no exista: si respondiéramos antes, el tiempo de
  // respuesta delataría qué correos tienen cuenta.
  const ok = await verifyPassword(password, customer?.passwordHash ?? "scrypt:00:00");
  if (!customer || !ok) return { error: "Correo o contraseña incorrectos." };

  await db.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, customer.id));
  await createCustomerSession(customer.id);
  redirect("/cuenta");
}

export async function signOut() {
  await destroyCustomerSession();
  redirect("/");
}

/**
 * Encuentra o crea la cuenta que corresponde a un perfil de Google.
 *
 * Tres casos:
 *  - Ya entró antes con Google: se reconoce por su `googleId`, aunque haya
 *    cambiado el correo en Google.
 *  - Tenía cuenta con contraseña y el mismo correo: se vincula, no se duplica.
 *    Es seguro porque Google ya confirmó que ese correo es suyo.
 *  - No existe: se crea.
 *
 * Está aparte de `signInWithGoogle` para poder probarla sin un token real.
 */
export async function linkGoogleCustomer(profile: GoogleProfile): Promise<string> {
  const [byGoogle] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.googleId, profile.googleId))
    .limit(1);

  if (byGoogle) {
    await db
      .update(customers)
      .set({ lastLoginAt: new Date() })
      .where(eq(customers.id, byGoogle.id));
    return byGoogle.id;
  }

  const [byEmail] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`lower(${customers.email}) = ${profile.email}`)
    .limit(1);

  if (byEmail) {
    await db
      .update(customers)
      .set({ googleId: profile.googleId, lastLoginAt: new Date() })
      .where(eq(customers.id, byEmail.id));
    return byEmail.id;
  }

  const id = randomUUID();
  await db.insert(customers).values({
    id,
    email: profile.email,
    name: profile.name.slice(0, 120),
    googleId: profile.googleId,
    // Sin contraseña: esta cuenta entra por Google.
    passwordHash: null,
    lastLoginAt: new Date(),
  });
  return id;
}

/** Entrar con Google desde el navegador. */
export async function signInWithGoogle(credential: string): Promise<AccountState> {
  let profile;
  try {
    profile = await verifyGoogleCredential(credential);
  } catch (err) {
    console.warn("[google] token rechazado:", err instanceof Error ? err.message : err);
    return { error: "No se pudo entrar con Google. Inténtalo otra vez." };
  }

  const id = await linkGoogleCustomer(profile);
  await createCustomerSession(id);
  redirect("/cuenta");
}

/** Los pedidos de quien está en sesión. Nunca los de otra persona. */
export async function myOrders(): Promise<Order[]> {
  const customer = await getCustomer();
  if (!customer) return [];

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customer.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.getTime(),
    statusAt: row.statusAt.getTime(),
    status: row.status,
    mode: row.mode,
    storeId: row.storeId,
    customer: row.customer,
    lines: row.lines,
    subtotal: row.subtotal,
    delivery: row.delivery,
    total: row.total,
    payment: row.payment,
    channel: row.channel,
  }));
}

export async function myAddresses() {
  const customer = await getCustomer();
  if (!customer) return [];
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.customerId, customer.id))
    .orderBy(desc(addresses.createdAt));
}

export async function addAddress(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const customer = await requireCustomer();
  const label = String(formData.get("label") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!label || !address) return { error: "Ponle un nombre y escribe la dirección." };

  await db.insert(addresses).values({
    id: randomUUID(),
    customerId: customer.id,
    label: label.slice(0, 60),
    address: address.slice(0, 200),
    notes: notes.slice(0, 200) || null,
  });

  revalidatePath("/cuenta");
  return {};
}

export async function removeAddress(id: string) {
  const customer = await requireCustomer();
  // El filtro por cliente es lo que impide borrar la dirección de otra persona.
  await db
    .delete(addresses)
    .where(sql`${addresses.id} = ${id} and ${addresses.customerId} = ${customer.id}`);
  revalidatePath("/cuenta");
  return { ok: true };
}

/** Sellos: se cuentan los pedidos entregados, no se guarda un contador aparte. */
export async function myStamps() {
  const customer = await getCustomer();
  if (!customer) return { delivered: 0, toward: 0 };
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`${orders.customerId} = ${customer.id} and ${orders.status} = 'entregado'`);
  const delivered = row?.n ?? 0;
  return { delivered, toward: delivered % 6 };
}

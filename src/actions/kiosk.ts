"use server";

import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kioskSessions } from "@/db/schema";
import {
  checkKioskPassword,
  clearKioskPassword,
  closeKioskSession,
  createKioskSession,
  getKioskSession,
  kioskConfigured,
  setKioskPassword,
  touchKiosk,
  type KioskSession,
} from "@/lib/kiosk";
import { checkPasswordStrength } from "@/lib/password";
import { requireUser } from "@/lib/session";
import { loadSiteContent } from "./content";
import { createOrder } from "@/lib/create-order";
import type { CartLine } from "@/lib/cart";

/**
 * Quiosco: la pantalla de autopedido.
 *
 * Dos grupos de acciones. Las de abajo del todo las usa el equipo desde
 * /equipo y exigen rol admin. Las de arriba las usa la propia tablet y sólo
 * exigen que esté desbloqueada.
 */

/* ------------------------------------------------------------------ */
/* Lo que hace la tablet                                              */
/* ------------------------------------------------------------------ */

const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_INTENTOS = 10;
const VENTANA = 10 * 60 * 1000;

/**
 * Freno a la fuerza bruta. En memoria, así que se reinicia con el servidor y
 * no se comparte entre instancias: es un primer filtro, no la defensa. Con
 * varias instancias esto se mueve a la base.
 *
 * Va por IP, no global: con un contador único, cualquiera podría gastar los
 * diez intentos desde fuera y dejar a la tienda sin poder montar su tablet.
 */
async function frenado() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ahora = Date.now();
  const e = intentos.get(ip);
  if (!e || e.hasta < ahora) {
    intentos.set(ip, { n: 1, hasta: ahora + VENTANA });
    return false;
  }
  e.n++;
  return e.n > MAX_INTENTOS;
}

async function limpiarFreno() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  intentos.delete(ip);
}

export async function unlockKiosk(
  password: string,
  storeId: string,
  label: string,
): Promise<{ ok: true } | { error: string }> {
  if (await frenado()) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }

  if (!(await kioskConfigured())) {
    return { error: "El quiosco no está activado. Actívalo desde la vista de equipo." };
  }

  // La sede tiene que existir de verdad: si no, los pedidos irían a una barra
  // que no está en ninguna parte.
  const site = await loadSiteContent();
  if (!site.stores.some((s) => s.id === storeId)) {
    return { error: "Elige una sede." };
  }

  if (!(await checkKioskPassword(password))) {
    return { error: "Clave incorrecta." };
  }

  await limpiarFreno();
  await createKioskSession(storeId, label);
  return { ok: true };
}

/** Qué pantalla es ésta, para pintar la sede en la cabecera. */
export async function currentKiosk(): Promise<KioskSession | null> {
  return getKioskSession();
}

export async function lockKiosk(password: string): Promise<{ ok: true } | { error: string }> {
  // Salir también pide la clave: si no, cualquier cliente podría cerrar la
  // pantalla y dejar la tienda sin autopedido.
  if (await frenado()) return { error: "Demasiados intentos. Espera unos minutos." };
  if (!(await checkKioskPassword(password))) return { error: "Clave incorrecta." };
  await closeKioskSession();
  return { ok: true };
}

/**
 * Manda el pedido a la barra.
 *
 * Sin dirección, sin cuenta y sin teléfono: se pide de pie en el mostrador y
 * se paga ahí. Lo único que hace falta es un nombre para cantarlo.
 *
 * Los precios los recalcula `createOrder` contra el contenido publicado, igual
 * que en la tienda: la tablet manda una intención de compra, no una factura.
 *
 * `paymentMethod` es lo que el cliente toca en la pantalla -«voy a pagar con
 * tarjeta»-, no una confirmación de que ya pagó: por eso `payment` se queda
 * siempre en "pendiente" y es la barra quien cobra al entregar. `OrderCard`
 * tiene que seguir mostrando "Sin pagar" mientras `payment` diga eso, sin
 * importar qué traiga `paymentMethod`.
 */
export async function placeKioskOrder(
  lines: CartLine[],
  name: string,
  notes?: string,
  /** El total que la pantalla le enseñó a la persona. */
  expectedTotal?: number,
  paymentMethod?: "tarjeta" | "efectivo" | "transferencia",
): Promise<{ id: string } | { error: string }> {
  const kiosko = await getKioskSession();
  if (!kiosko) return { error: "Esta pantalla ya no está autorizada. Avisa a la barra." };

  const nombre = name.trim();
  if (!nombre) return { error: "Escribe un nombre para el pedido." };

  const res = await createOrder(
    {
      lines,
      mode: "recoger",
      storeId: kiosko.storeId,
      customer: { name: nombre.slice(0, 60), phone: "", notes: notes?.trim() || undefined },
      channel: "mostrador",
      // Si el equipo cambia un precio mientras alguien está pidiendo, mejor
      // rechazar y que lo rehaga que enseñarle un total en pantalla y cobrarle
      // otro distinto en la barra.
      expectedTotal,
    },
    { payment: "pendiente", paymentMethod },
  );

  if ("error" in res) return res;

  await touchKiosk(kiosko.id);
  return { id: res.id };
}

/* ------------------------------------------------------------------ */
/* Lo que hace el equipo                                              */
/* ------------------------------------------------------------------ */

export type KioskAdminResult = { ok: true; mensaje: string } | { error: string };

export type KioskRow = {
  id: string;
  storeId: string;
  label: string;
  createdAt: number;
  lastSeenAt: number | null;
};

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Sólo un administrador puede configurar el quiosco.");
  return user;
}

export async function kioskStatus(): Promise<{ activo: boolean; pantallas: KioskRow[] }> {
  await requireAdmin();
  const filas = await db
    .select()
    .from(kioskSessions)
    .orderBy(desc(kioskSessions.createdAt))
    .limit(50);

  return {
    activo: await kioskConfigured(),
    pantallas: filas.map((f) => ({
      id: f.id,
      storeId: f.storeId,
      label: f.label,
      createdAt: f.createdAt.getTime(),
      lastSeenAt: f.lastSeenAt?.getTime() ?? null,
    })),
  };
}

export async function saveKioskPassword(password: string): Promise<KioskAdminResult> {
  const user = await requireAdmin();
  const flojo = checkPasswordStrength(password);
  if (flojo) return { error: flojo };

  await setKioskPassword(password, user.email);
  return { ok: true, mensaje: "Clave del quiosco guardada. Las pantallas ya conectadas siguen." };
}

export async function disableKiosk(): Promise<KioskAdminResult> {
  await requireAdmin();
  await clearKioskPassword();
  return { ok: true, mensaje: "Quiosco desactivado y todas las pantallas desconectadas." };
}

/** Desconecta una pantalla concreta: la tablet que se quedó en un taxi. */
export async function revokeKiosk(id: string): Promise<KioskAdminResult> {
  await requireAdmin();
  await db.delete(kioskSessions).where(eq(kioskSessions.id, id));
  return { ok: true, mensaje: "Pantalla desconectada." };
}

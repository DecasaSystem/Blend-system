"use server";

import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kioskSessions, orders } from "@/db/schema";
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
import { paymentsEnabled, startPayment } from "@/lib/payments";
import { resolveOrderReturn, type ReturnState } from "@/lib/settle-payment";
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
/* Pagar ahora, desde la tablet                                       */
/* ------------------------------------------------------------------ */

/**
 * El mismo cobro en línea de la tienda, pero pensado para una pantalla que
 * no es del cliente: se crea el pedido en `pago`, se abre un link de Bold y
 * la tablet lo enseña como QR para pagar desde el celular (o lo abre en la
 * propia pantalla). El pedido no sale a la barra hasta que Bold confirme,
 * igual que en la web; si el cliente se arrepiente puede pasarlo a caja.
 *
 * La vuelta de Bold es `/quiosco?pedido=…`, y la sesión del quiosco viaja en
 * su cookie, así que la tablet sigue desbloqueada al volver.
 */
export async function startKioskPayment(
  lines: CartLine[],
  name: string,
  notes?: string,
  expectedTotal?: number,
): Promise<{ id: string; url: string } | { error: string }> {
  const kiosko = await getKioskSession();
  if (!kiosko) return { error: "Esta pantalla ya no está autorizada. Avisa a la barra." };
  if (!paymentsEnabled()) return { error: "El pago en línea no está disponible. Paga en caja." };

  const nombre = name.trim();
  if (!nombre) return { error: "Escribe un nombre para el pedido." };

  const created = await createOrder(
    {
      lines,
      mode: "recoger",
      storeId: kiosko.storeId,
      customer: { name: nombre.slice(0, 60), phone: "", notes: notes?.trim() || undefined },
      channel: "mostrador",
      expectedTotal,
    },
    { payment: "tarjeta", awaitingPayment: true },
  );
  if ("error" in created) return created;

  try {
    const { url, ref } = await startPayment({
      orderId: created.id,
      total: created.total,
      description: `Pedido ${created.id} · BLEND mostrador`,
      redirectUrl: `${await origen()}/quiosco?pedido=${created.id}`,
    });
    await db.update(orders).set({ paymentRef: ref }).where(eq(orders.id, created.id));
    await touchKiosk(kiosko.id);
    return { id: created.id, url };
  } catch (err) {
    // Sin link no hay cobro posible: se cierra ya y la tablet ofrece caja.
    await db
      .update(orders)
      .set({ status: "fallido", statusAt: new Date() })
      .where(eq(orders.id, created.id));
    console.error("[bold] quiosco: no se pudo crear el link", err);
    return { error: "No se pudo abrir el pago en línea. Puedes pagar en caja." };
  }
}

/**
 * La tablet pregunta cada pocos segundos si el cliente ya pagó desde su
 * celular. Consulta a Bold si hace falta (en modo pruebas no hay webhook) y
 * aplica el resultado: es lo mismo que hace la página de vuelta.
 */
export async function kioskPaymentStatus(orderId: string): Promise<{ state: ReturnState }> {
  const kiosko = await getKioskSession();
  if (!kiosko) return { state: "failed" };
  if (!(await esDeEstaPantalla(orderId, kiosko))) return { state: "failed" };
  const { state } = await resolveOrderReturn(orderId);
  return { state };
}

/**
 * «Mejor pago en caja»: el pedido sale a la barra ya, marcado sin pagar, como
 * cualquier pedido de mostrador. Sólo si todavía estaba esperando el cobro.
 * Si a pesar de todo el cliente paga el link desde el celular después,
 * `settlePayment` lo anota como pagado para que la barra no cobre dos veces.
 */
export async function kioskPayAtCounter(
  orderId: string,
  paymentMethod?: "tarjeta" | "efectivo" | "transferencia",
): Promise<{ ok: true } | { error: string }> {
  const kiosko = await getKioskSession();
  if (!kiosko) return { error: "Esta pantalla ya no está autorizada." };
  if (!(await esDeEstaPantalla(orderId, kiosko))) return { error: "Ese pedido no es de aquí." };

  await db
    .update(orders)
    .set({
      status: "nuevo",
      statusAt: new Date(),
      payment: "pendiente",
      paymentMethod: paymentMethod ?? null,
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pago")));
  return { ok: true };
}

/** El cliente se fue o canceló: el pedido no sale a la barra. */
export async function kioskCancelPayment(orderId: string): Promise<{ ok: true }> {
  const kiosko = await getKioskSession();
  if (kiosko && (await esDeEstaPantalla(orderId, kiosko))) {
    await db
      .update(orders)
      .set({ status: "fallido", statusAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pago")));
  }
  return { ok: true };
}

/** Una tablet sólo toca pedidos de mostrador de su propia sede. */
async function esDeEstaPantalla(orderId: string, kiosko: KioskSession) {
  const [row] = await db
    .select({ channel: orders.channel, storeId: orders.storeId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return Boolean(row && row.channel === "mostrador" && row.storeId === kiosko.storeId);
}

/** La URL pública, para que Bold devuelva a la tablet a su propia pantalla. */
async function origen() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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

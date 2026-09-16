"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { courierPositions, orders, users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { requireCustomer } from "@/lib/customer-session";
import type { LatLng } from "@/lib/geo";

/**
 * Seguimiento del domicilio: el cliente ve venir la moto.
 *
 * El celular del repartidor manda su posición cada pocos segundos mientras
 * tenga algo «en camino» (ver `useCourierTracking`), y la cuenta del cliente
 * la pregunta con la misma cadencia. No hay tiempo real ni sockets: con los
 * domicilios que hay a la vez, un polling de cinco segundos sobra.
 *
 * Privacidad, en el servidor y no en el navegador:
 * - Sólo se guarda la posición si el repartidor tiene de verdad un pedido en
 *   la calle. Un celular que siga mandando por error no deja rastro.
 * - Sólo la ve el cliente dueño del pedido, y sólo entre «salí» y «entregado».
 * - Al cerrar el último domicilio la fila se borra (`delivery.ts`).
 */

export type CourierFix = LatLng & {
  /** Rumbo en grados, 0 = norte; nulo si el GPS no lo da. */
  heading: number | null;
  /** Cuándo se recibió, en ms. Si se queda atrás, el celular dejó de mandar. */
  at: number;
};

function cleanFix(input: unknown): (LatLng & { heading: number | null }) | null {
  if (!input || typeof input !== "object") return null;
  const f = input as Partial<CourierFix>;
  if (
    typeof f.lat !== "number" ||
    typeof f.lng !== "number" ||
    !Number.isFinite(f.lat) ||
    !Number.isFinite(f.lng) ||
    Math.abs(f.lat) > 90 ||
    Math.abs(f.lng) > 180
  ) {
    return null;
  }
  const heading =
    typeof f.heading === "number" && Number.isFinite(f.heading)
      ? ((f.heading % 360) + 360) % 360
      : null;
  return { lat: Number(f.lat.toFixed(6)), lng: Number(f.lng.toFixed(6)), heading };
}

/** El repartidor reporta dónde va. Se ignora en silencio si no lleva nada en la calle. */
export async function reportPosition(fix: unknown): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (me.role !== "repartidor" && me.role !== "admin") {
    return { error: "Esta parte es sólo para repartidores." };
  }
  const clean = cleanFix(fix);
  if (!clean) return { error: "La ubicación no es válida." };

  const [live] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.courierId, me.id), eq(orders.status, "listo"), isNotNull(orders.outAt)))
    .limit(1);
  if (!live) return { ok: true };

  const now = new Date();
  await db
    .insert(courierPositions)
    .values({ userId: me.id, ...clean, updatedAt: now })
    .onConflictDoUpdate({
      target: courierPositions.userId,
      set: { lat: clean.lat, lng: clean.lng, heading: clean.heading, updatedAt: now },
    });
  return { ok: true };
}

/** El repartidor apaga el seguimiento (se queda sin domicilios, o cierra la pantalla). */
export async function clearPosition(): Promise<void> {
  const me = await requireUser();
  await db.delete(courierPositions).where(eq(courierPositions.userId, me.id));
}

export type Tracking = {
  courierName: string;
  /** Nulo si el repartidor salió pero su celular todavía no ha mandado nada. */
  fix: CourierFix | null;
};

/**
 * Dónde va el repartidor de mi pedido. Nulo si el pedido no es mío, no es a
 * domicilio o no está en la calle: la cuenta usa ese nulo para saber que ya
 * llegó (o que todavía no ha salido) y volver a pintar el pedido.
 */
export async function trackOrder(orderId: string): Promise<Tracking | null> {
  const customer = await requireCustomer();
  const [row] = await db
    .select({
      courierName: users.name,
      lat: courierPositions.lat,
      lng: courierPositions.lng,
      heading: courierPositions.heading,
      updatedAt: courierPositions.updatedAt,
    })
    .from(orders)
    .innerJoin(users, eq(orders.courierId, users.id))
    .leftJoin(courierPositions, eq(courierPositions.userId, users.id))
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.customerId, customer.id),
        eq(orders.mode, "envio"),
        eq(orders.status, "listo"),
        isNotNull(orders.outAt),
        sql`${orders.courierId} is not null`,
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    courierName: row.courierName,
    fix:
      row.lat != null && row.lng != null && row.updatedAt
        ? { lat: row.lat, lng: row.lng, heading: row.heading ?? null, at: row.updatedAt.getTime() }
        : null,
  };
}

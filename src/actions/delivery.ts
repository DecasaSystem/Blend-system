"use server";

import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { courierPositions, orders, users } from "@/db/schema";
import { after } from "next/server";
import { requireStaff, requireUser, type SessionUser } from "@/lib/session";
import { pushToCustomer, pushToUser } from "@/lib/push";
import type { Order } from "@/lib/orders";

/**
 * Reparto.
 *
 * Dos lados. La barra asigna un repartidor a un domicilio (o lo quita); el
 * repartidor ve sus entregas, toma las que nadie ha tomado, avisa que salió y
 * marca entregado. Cada acción comprueba en el servidor quién es y de quién
 * es el pedido: un repartidor sólo toca domicilios suyos o sin dueño, y no
 * ve nada más del tablero (`requireStaff` se lo cierra en `orders.ts`).
 *
 * «En camino» no es un estado nuevo: es `listo` con `outAt` puesto. Así el
 * tablero sigue teniendo cuatro columnas y los pedidos para recoger no se
 * enteran de que existe el reparto.
 */

export type Courier = { id: string; name: string };

/** Los repartidores, para el desplegable de asignar en la tarjeta. */
export async function listCouriers(): Promise<Courier[]> {
  await requireStaff();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "repartidor"))
    .orderBy(users.name);
  return rows;
}

/** La barra asigna (o quita, con null) el repartidor de un domicilio. */
export async function assignCourier(
  orderId: string,
  courierId: string | null,
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();

  if (courierId) {
    const [c] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, courierId), eq(users.role, "repartidor")))
      .limit(1);
    if (!c) return { error: "Ese repartidor no existe." };
  }

  const [row] = await db
    .update(orders)
    .set({
      courierId,
      assignedAt: courierId ? new Date() : null,
      // Si se cambia de repartidor, el «salí» del anterior ya no vale.
      outAt: null,
    })
    .where(and(eq(orders.id, orderId), eq(orders.mode, "envio")))
    .returning({ id: orders.id, address: sql<string>`${orders.customer}->>'address'` });
  if (courierId && row) {
    after(() =>
      pushToUser(courierId, {
        title: `Te asignaron el domicilio ${row.id}`,
        body: row.address ?? "Mira tu pantalla de reparto.",
        url: "/equipo/reparto",
        tag: `asignado-${row.id}`,
      }),
    );
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Lo que ve y hace el repartidor                                      */
/* ------------------------------------------------------------------ */

/** Un repartidor, o un administrador mirando cómo va el reparto. */
async function requireCourier(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "repartidor" && user.role !== "admin") {
    throw new Error("Esta parte es sólo para repartidores.");
  }
  return user;
}

/**
 * Si ya no le queda nada en la calle, su posición deja de existir: el
 * seguimiento sólo dura lo que dura el domicilio.
 */
async function forgetPositionIfIdle(courierId: string) {
  const [live] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.courierId, courierId), eq(orders.status, "listo"), isNotNull(orders.outAt)),
    )
    .limit(1);
  if (!live) await db.delete(courierPositions).where(eq(courierPositions.userId, courierId));
}

export type DeliveryBoard = {
  /** Asignados a mí, todavía sin entregar (en la barra o ya en la calle). */
  mine: Order[];
  /** Domicilios listos que nadie ha tomado, para tomarlos. */
  available: Order[];
  /** Entregados por mí hoy. */
  doneToday: Order[];
};

const columns = {
  id: orders.id,
  createdAt: orders.createdAt,
  statusAt: orders.statusAt,
  status: orders.status,
  mode: orders.mode,
  storeId: orders.storeId,
  customer: orders.customer,
  lines: orders.lines,
  subtotal: orders.subtotal,
  delivery: orders.delivery,
  total: orders.total,
  payment: orders.payment,
  paymentMethod: orders.paymentMethod,
  channel: orders.channel,
  courierId: orders.courierId,
  courierName: users.name,
  outAt: orders.outAt,
};

/** Pedido con el nombre de quien lo lleva. */
function base() {
  return db.select(columns).from(orders).leftJoin(users, eq(orders.courierId, users.id));
}
type Row = Awaited<ReturnType<typeof base>>[number];

function toOrder(r: Row): Order {
  return {
    id: r.id,
    createdAt: r.createdAt.getTime(),
    statusAt: r.statusAt.getTime(),
    status: r.status,
    mode: r.mode,
    storeId: r.storeId,
    customer: r.customer,
    lines: r.lines,
    subtotal: r.subtotal,
    delivery: r.delivery,
    total: r.total,
    payment: r.payment,
    paymentMethod: r.paymentMethod ?? undefined,
    channel: r.channel,
    courierId: r.courierId ?? null,
    courierName: r.courierName ?? null,
    outAt: r.outAt ? r.outAt.getTime() : null,
  };
}

export async function myDeliveries(): Promise<DeliveryBoard> {
  const me = await requireCourier();

  // Medianoche de hoy en Colombia, no en el servidor (Vercel corre en UTC).
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const hoy = new Date(`${ymd}T00:00:00-05:00`);

  const [mine, available, doneToday] = await Promise.all([
    base()
      .where(
        and(
          eq(orders.courierId, me.id),
          eq(orders.mode, "envio"),
          sql`${orders.status} in ('nuevo', 'preparando', 'listo')`,
        ),
      )
      .orderBy(orders.createdAt),
    base()
      .where(
        and(isNull(orders.courierId), eq(orders.mode, "envio"), eq(orders.status, "listo")),
      )
      .orderBy(orders.createdAt),
    base()
      .where(
        and(
          eq(orders.courierId, me.id),
          eq(orders.status, "entregado"),
          gte(orders.statusAt, hoy),
        ),
      )
      .orderBy(desc(orders.statusAt))
      .limit(50),
  ]);

  return {
    mine: mine.map(toOrder),
    available: available.map(toOrder),
    doneToday: doneToday.map(toOrder),
  };
}

/** Tomar un domicilio que nadie tiene. Gana el primero: el WHERE lo garantiza. */
export async function takeDelivery(orderId: string): Promise<{ ok: true } | { error: string }> {
  const me = await requireCourier();
  const res = await db
    .update(orders)
    .set({ courierId: me.id, assignedAt: new Date(), outAt: null })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.mode, "envio"),
        isNull(orders.courierId),
        sql`${orders.status} in ('nuevo', 'preparando', 'listo')`,
      ),
    )
    .returning({ id: orders.id });
  if (res.length === 0) return { error: "Ese pedido ya lo tomó otra persona." };
  return { ok: true };
}

/** «Salí»: el pedido pasa a verse «En camino» en la barra y en la cuenta del cliente. */
export async function startDelivery(orderId: string): Promise<{ ok: true } | { error: string }> {
  const me = await requireCourier();
  const res = await db
    .update(orders)
    .set({ outAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.courierId, me.id), eq(orders.status, "listo")))
    .returning({ id: orders.id, customerId: orders.customerId });
  if (res.length === 0) return { error: "Ese pedido no está listo o no es tuyo." };
  const [o] = res;
  if (o.customerId) {
    after(() =>
      pushToCustomer(o.customerId!, {
        title: `Tu pedido ${o.id} va en camino 🛵`,
        body: `${me.name} ya salió con él. Míralo venir en el mapa de tu cuenta.`,
        url: "/cuenta",
        tag: `pedido-${o.id}`,
      }),
    );
  }
  return { ok: true };
}

/** Entregado. Cierra el pedido; es lo que cuenta como sello para el cliente. */
export async function completeDelivery(
  orderId: string,
): Promise<{ ok: true } | { error: string }> {
  const me = await requireCourier();
  const res = await db
    .update(orders)
    .set({ status: "entregado", statusAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.courierId, me.id),
        sql`${orders.status} in ('listo', 'preparando')`,
      ),
    )
    .returning({ id: orders.id, customerId: orders.customerId });
  if (res.length === 0) return { error: "Ese pedido no es tuyo o ya está cerrado." };
  const [o] = res;
  after(() => forgetPositionIfIdle(me.id));
  if (o.customerId) {
    after(() =>
      pushToCustomer(o.customerId!, {
        title: `Pedido ${o.id} entregado ✓`,
        body: "¡Que lo disfrutes! Ya suma un sello en tu cuenta.",
        url: "/cuenta",
        tag: `pedido-${o.id}`,
      }),
    );
  }
  return { ok: true };
}

/** «No puedo llevarlo»: vuelve a la lista de disponibles. */
export async function releaseDelivery(
  orderId: string,
): Promise<{ ok: true } | { error: string }> {
  const me = await requireCourier();
  await db
    .update(orders)
    .set({ courierId: null, assignedAt: null, outAt: null })
    .where(
      and(eq(orders.id, orderId), eq(orders.courierId, me.id), sql`${orders.status} <> 'entregado'`),
    );
  after(() => forgetPositionIfIdle(me.id));
  return { ok: true };
}

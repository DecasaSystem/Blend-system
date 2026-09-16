"use server";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { createOrder, type PlaceOrderInput } from "@/lib/create-order";
import { expireStalePayments } from "@/lib/settle-payment";
import { paymentsEnabled } from "@/lib/payments";
import { after } from "next/server";
import { pushToCustomer } from "@/lib/push";
import { requireStaff } from "@/lib/session";
import { STATUSES, type BoardStatus, type Order } from "@/lib/orders";

/**
 * Pedidos.
 *
 * Crear un pedido es público: lo hace quien compra, sin sesión. Todo lo
 * demás —leer el tablero, mover estados, borrar— exige sesión iniciada, y
 * eso se comprueba aquí, en el servidor, no en el navegador.
 *
 * El motor de creación vive en `@/lib/create-order`, fuera de este archivo
 * `"use server"` a propósito: cualquier función exportada de aquí se
 * convierte en un endpoint HTTP público invocable directamente, y cómo se
 * pagó un pedido no puede ser uno de esos campos. Ver el comentario de
 * `create-order.ts` para el porqué completo.
 */

export type { PlaceOrderInput };

function toOrder(row: typeof orders.$inferSelect & { courierName: string | null }): Order {
  return {
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
    paymentMethod: row.paymentMethod ?? undefined,
    channel: row.channel,
    courierId: row.courierId,
    courierName: row.courierName,
    outAt: row.outAt ? row.outAt.getTime() : null,
  };
}

/** Único punto público: fuerza siempre "pendiente". */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ id: string; total: number } | { error: string }> {
  // Los domicilios se pagan en línea: el repartidor no cobra. Sin pasarela
  // configurada no hay alternativa, y se acepta al recibir como siempre.
  if (input.mode === "envio" && paymentsEnabled()) {
    return { error: "Los domicilios se pagan en línea al hacer el pedido." };
  }
  return createOrder(input, { payment: "pendiente" });
}

/** El tablero: todo menos lo que aún no se ha cobrado o no se llegó a pagar. */
export async function listOrders(): Promise<Order[]> {
  await requireStaff();
  // El tablero se consulta cada pocos segundos: buen momento para dar por
  // vencidos los pagos que nadie terminó, sin necesitar un cron aparte.
  await expireStalePayments();
  const rows = await db
    .select({ order: orders, courierName: users.name })
    .from(orders)
    .leftJoin(users, eq(orders.courierId, users.id))
    .where(sql`${orders.status} not in ('pago', 'fallido')`)
    .orderBy(desc(orders.createdAt))
    .limit(200);
  return rows.map((r) => toOrder({ ...r.order, courierName: r.courierName }));
}

export async function updateOrderStatus(id: string, status: BoardStatus) {
  await requireStaff();
  // Sólo las columnas del tablero: a `pago` no se vuelve a mano.
  if (!STATUSES.includes(status)) return { error: "Estado desconocido." };
  const [o] = await db
    .update(orders)
    .set({ status, statusAt: new Date() })
    .where(eq(orders.id, id))
    .returning({ id: orders.id, mode: orders.mode, customerId: orders.customerId });
  // Al cliente con cuenta se le avisa de lo que le importa: que ya puede
  // pasar a recogerlo. Los domicilios avisan desde el reparto («va en camino»).
  if (o?.customerId && status === "listo" && o.mode === "recoger") {
    after(() =>
      pushToCustomer(o.customerId!, {
        title: `Tu pedido ${o.id} está listo`,
        body: "Ya puedes pasar a recogerlo.",
        url: "/cuenta",
        tag: `pedido-${o.id}`,
      }),
    );
  }
  return { ok: true };
}

export async function deleteOrder(id: string) {
  await requireStaff();
  await db.delete(orders).where(eq(orders.id, id));
  return { ok: true };
}

export async function clearAllOrders() {
  const user = await requireStaff();
  if (user.role !== "admin") return { error: "Sólo un administrador puede borrar el historial." };
  await db.delete(orders);
  return { ok: true };
}

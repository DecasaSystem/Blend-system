"use server";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { createOrder, type PlaceOrderInput } from "@/lib/create-order";
import { requireUser } from "@/lib/session";
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

function toOrder(row: typeof orders.$inferSelect): Order {
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
  };
}

/** Único punto público: fuerza siempre "pendiente". */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ id: string; total: number } | { error: string }> {
  return createOrder(input, { payment: "pendiente" });
}

/** El tablero: todo menos lo que aún no se ha cobrado. */
export async function listOrders(): Promise<Order[]> {
  await requireUser();
  const rows = await db
    .select()
    .from(orders)
    .where(sql`${orders.status} <> 'pago'`)
    .orderBy(desc(orders.createdAt))
    .limit(200);
  return rows.map(toOrder);
}

export async function updateOrderStatus(id: string, status: BoardStatus) {
  await requireUser();
  // Sólo las columnas del tablero: a `pago` no se vuelve a mano.
  if (!STATUSES.includes(status)) return { error: "Estado desconocido." };
  await db.update(orders).set({ status, statusAt: new Date() }).where(eq(orders.id, id));
  return { ok: true };
}

export async function deleteOrder(id: string) {
  await requireUser();
  await db.delete(orders).where(eq(orders.id, id));
  return { ok: true };
}

export async function clearAllOrders() {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "Sólo un administrador puede borrar el historial." };
  await db.delete(orders);
  return { ok: true };
}

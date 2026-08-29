"use server";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { counters, orders, ORDER_COUNTER } from "@/db/schema";
import { totals, type CartLine, type DeliveryMode } from "@/lib/cart";
import { requireUser } from "@/lib/session";
import { getCustomer } from "@/lib/customer-session";
import { STATUSES, type BoardStatus, type Customer, type Order } from "@/lib/orders";

/**
 * Pedidos.
 *
 * Crear un pedido es público: lo hace quien compra. Todo lo demás —leer el
 * tablero, mover estados, borrar— exige sesión iniciada, y eso se comprueba
 * aquí, en el servidor, no en el navegador.
 */

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
    channel: row.channel,
  };
}

/** Número de pedido consecutivo, a prueba de dos compras a la vez. */
async function nextOrderId() {
  const [row] = await db
    .insert(counters)
    .values({ name: ORDER_COUNTER, value: 1043 })
    .onConflictDoUpdate({
      target: counters.name,
      set: { value: sql`${counters.value} + 1` },
    })
    .returning({ value: counters.value });
  return `B-${row.value}`;
}

export type PlaceOrderInput = {
  lines: CartLine[];
  mode: DeliveryMode;
  storeId: string;
  customer: Customer;
  payment?: Order["payment"];
  channel?: Order["channel"];
  /** Con tarjeta el pedido nace en `pago` y no sale al tablero hasta cobrarse. */
  awaitingPayment?: boolean;
};

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ id: string; total: number } | { error: string }> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { error: "El pedido está vacío." };
  }
  if (!input.customer?.name?.trim() || !input.customer?.phone?.trim()) {
    return { error: "Falta el nombre o el teléfono." };
  }
  if (input.mode === "envio" && !input.customer.address?.trim()) {
    return { error: "Falta la dirección de entrega." };
  }

  // Los importes se recalculan en el servidor: los que manda el navegador
  // son sólo para pintar, nunca para cobrar.
  const t = totals(input.lines, input.mode);
  const id = await nextOrderId();

  // El cliente sale de la sesión, no de lo que mande el navegador: si no,
  // cualquiera podría colgar un pedido de la cuenta de otra persona.
  const customer = await getCustomer();

  await db.insert(orders).values({
    id,
    customerId: customer?.id ?? null,
    mode: input.mode,
    storeId: input.storeId,
    customer: {
      name: input.customer.name.trim().slice(0, 120),
      phone: input.customer.phone.trim().slice(0, 40),
      address: input.customer.address?.trim().slice(0, 200),
      notes: input.customer.notes?.trim().slice(0, 300),
    },
    lines: input.lines,
    subtotal: t.subtotal,
    delivery: t.delivery,
    total: t.total,
    payment: input.payment ?? "pendiente",
    channel: input.channel ?? "web",
    status: input.awaitingPayment ? "pago" : "nuevo",
  });

  return { id, total: t.total };
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

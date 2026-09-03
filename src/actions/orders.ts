"use server";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { counters, orders, ORDER_COUNTER } from "@/db/schema";
import { repriceLines, totals, type CartLine, type DeliveryMode } from "@/lib/cart";
import { getSessionUser, requireUser } from "@/lib/session";
import { getKioskSession } from "@/lib/kiosk";
import { getCustomer } from "@/lib/customer-session";
import { STATUSES, type BoardStatus, type Customer, type Order } from "@/lib/orders";
import { loadSiteContent } from "./content";

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
  /**
   * El total que el cliente tenía en pantalla. Si el servidor calcula otro
   * —porque el equipo cambió un precio a mitad de compra— no se cobra a ciegas:
   * se rechaza para que lo vuelva a mirar.
   */
  expectedTotal?: number;
};

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ id: string; total: number } | { error: string }> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { error: "El pedido está vacío." };
  }

  /*
   * Un pedido de mostrador no lleva teléfono: se pide de pie en la barra y se
   * recoge ahí mismo. Pero el canal no puede decidirlo quien envía el pedido,
   * o cualquiera desde la web se declararía «mostrador» para saltarse el
   * teléfono y la barra se quedaría sin forma de avisar. Así que se comprueba
   * que venga de una pantalla de quiosco autorizada, o de alguien del equipo
   * tomando el pedido a mano.
   */
  const mostrador =
    input.channel === "mostrador" && Boolean((await getKioskSession()) ?? (await getSessionUser()));

  if (!input.customer?.name?.trim()) return { error: "Falta el nombre." };
  if (!mostrador && !input.customer?.phone?.trim()) {
    return { error: "Falta el nombre o el teléfono." };
  }
  if (input.mode === "envio" && !input.customer.address?.trim()) {
    return { error: "Falta la dirección de entrega." };
  }

  // Los importes se recalculan en el servidor contra el contenido publicado:
  // los que manda el navegador son sólo para pintar, nunca para cobrar.
  const site = await loadSiteContent();
  const repriced = repriceLines(input.lines, site);
  if ("error" in repriced) return repriced;

  const lines = repriced.lines;
  const t = totals(lines, input.mode, site.pricing);

  if (typeof input.expectedTotal === "number" && input.expectedTotal !== t.total) {
    return { error: "Los precios cambiaron mientras pedías. Revisa el total antes de pagar." };
  }

  const id = await nextOrderId();

  /*
   * El cliente sale de la sesión, no de lo que mande el navegador: si no,
   * cualquiera podría colgar un pedido de la cuenta de otra persona.
   *
   * En mostrador no se cuelga de nadie. La tablet del quiosco es un navegador
   * compartido: si alguien entró a su cuenta en esa pantalla, todos los
   * pedidos que vinieran después se le habrían atribuido —y le habrían salido
   * en su historial pedidos de desconocidos.
   */
  const customer = mostrador ? null : await getCustomer();

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
    lines,
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

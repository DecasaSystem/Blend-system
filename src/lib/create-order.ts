import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { counters, orders, ORDER_COUNTER } from "@/db/schema";
import { repriceLines, totals, type CartLine, type DeliveryMode } from "@/lib/cart";
import { getSessionUser } from "@/lib/session";
import { getKioskSession } from "@/lib/kiosk";
import { getCustomer } from "@/lib/customer-session";
import type { Customer, Order } from "@/lib/orders";
import { loadSiteContent } from "@/actions/content";

/**
 * El motor de crear un pedido, compartido por la web pública, el pago con
 * tarjeta y el quiosco.
 *
 * Vive en `server-only`, no en un archivo `"use server"`. Es la diferencia
 * que importa: en un archivo con `"use server"`, cualquier función exportada
 * se convierte automáticamente en un endpoint HTTP público, invocable
 * directamente por cualquiera sin pasar por la interfaz -así es como
 * funcionan las Server Actions de Next-. `createOrder` recibe cómo se pagó
 * como segundo argumento aparte, decidido por quien la llama en el servidor,
 * y eso sólo protege algo si `createOrder` en sí no se puede invocar desde
 * fuera. `server-only` lo garantiza: es sólo una función importable desde
 * otro código de servidor, nunca una ruta.
 *
 * `src/actions/orders.ts` la envuelve en `placeOrder`, la única forma pública
 * de llegar hasta aquí, que fuerza siempre "pendiente".
 */

export type PlaceOrderInput = {
  lines: CartLine[];
  mode: DeliveryMode;
  storeId: string;
  customer: Customer;
  channel?: Order["channel"];
  /**
   * El total que el cliente tenía en pantalla. Si el servidor calcula otro
   * —porque el equipo cambió un precio a mitad de compra— no se cobra a ciegas:
   * se rechaza para que lo vuelva a mirar.
   */
  expectedTotal?: number;
};

/** Lo que sólo puede decidir el servidor, nunca quien manda el pedido. */
export type TrustedOrderState = {
  payment: Order["payment"];
  paymentMethod?: Order["paymentMethod"];
  /** Con tarjeta el pedido nace en `pago` y no sale al tablero hasta cobrarse. */
  awaitingPayment?: boolean;
};

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

export async function createOrder(
  input: PlaceOrderInput,
  trusted: TrustedOrderState,
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
    payment: trusted.payment,
    paymentMethod: trusted.paymentMethod ?? null,
    channel: input.channel ?? "web",
    status: trusted.awaitingPayment ? "pago" : "nuevo",
  });

  return { id, total: t.total };
}

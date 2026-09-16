import "server-only";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import {
  amountMatches,
  lookupPayment,
  PAYMENT_WINDOW_MINUTES,
  paymentsEnabled,
  type PaymentLookup,
} from "@/lib/payments";

/**
 * Aplicar al pedido lo que Bold dice de un cobro.
 *
 * Llega por dos caminos —el webhook y la página de vuelta— y los dos hacen
 * exactamente lo mismo, así que vive aquí una sola vez. Los dos pueden llegar
 * a la vez para el mismo pedido: por eso cada cambio va con un `WHERE status`
 * y gana el primero; el segundo no encuentra fila que tocar y no pasa nada.
 *
 * Es `server-only`: mover un pedido a la barra sin pasar por la pasarela no
 * puede ser una ruta pública.
 */

export type Settlement =
  /** Cobrado. El pedido ya está (o ya estaba) camino a la barra. */
  | "confirmed"
  /** El banco lo rechazó, se anuló, venció o dio error. Nadie pagó nada. */
  | "failed"
  /** El banco todavía lo está procesando (PSE). */
  | "pending"
  /** El cliente todavía no ha pagado: el link sigue abierto. */
  | "open"
  /** No hay pedido con esa referencia, o el monto no cuadra: no se toca nada. */
  | "ignored";

export async function settlePayment(tx: PaymentLookup): Promise<Settlement> {
  // Bold manda como referencia el id del link (`LNK_…`), que es lo que se
  // guardó en `payment_ref`; por si algún día mandara la nuestra, también se
  // busca por número de pedido.
  const [order] = await db
    .select({ id: orders.id, total: orders.total, status: orders.status })
    .from(orders)
    .where(or(eq(orders.paymentRef, tx.reference), eq(orders.id, tx.reference)))
    .limit(1);

  if (!order) {
    console.warn("[bold] referencia sin pedido:", tx.reference);
    return "ignored";
  }

  if (tx.status === "pending" || tx.status === "open") return tx.status;

  if (tx.status === "approved") {
    // Lo cobrado tiene que ser lo que costaba. Si no cuadra, no se libera nada
    // y queda anotado para revisarlo a mano.
    if (!amountMatches(order.total, tx.amount)) {
      console.error(
        `[bold] monto que no cuadra en ${order.id}: cobrado ${tx.amount}, esperado ${order.total}`,
      );
      return "ignored";
    }

    /*
     * Sólo se mueve si sigue esperando pago —o si se había dado por fallido:
     * un PSE puede quedar pendiente, vencer el plazo aquí, y aprobarse después.
     * La plata entró, así que el pedido tiene que salir. Lo que nunca se hace
     * es devolver atrás uno que la barra ya empezó a preparar: un reenvío de
     * Bold no encuentra fila en `pago`/`fallido` y no cambia nada.
     */
    await db
      .update(orders)
      .set({ status: "nuevo", statusAt: new Date(), paidAt: new Date(), payment: "tarjeta" })
      .where(and(eq(orders.id, order.id), inArray(orders.status, ["pago", "fallido"])));

    /*
     * Y si el pedido ya había salido a la barra como «pago en caja» —en el
     * quiosco se puede cambiar de idea— pero la plata entró igual por el
     * link (lo pagó desde el celular después), se anota como pagado sin
     * mover su columna: la barra tiene que saber que no debe cobrarlo.
     */
    await db
      .update(orders)
      .set({ payment: "tarjeta", paidAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.payment, "pendiente")));

    return "confirmed";
  }

  // Rechazado, cancelado, vencido o con error: el pedido pasa a fallido, pero
  // sólo desde `pago`. Si ya se cobró, un aviso tardío de otro intento no lo
  // deshace.
  await db
    .update(orders)
    .set({ status: "fallido", statusAt: new Date() })
    .where(and(eq(orders.id, order.id), eq(orders.status, "pago")));

  return order.status === "pago" || order.status === "fallido" ? "failed" : "confirmed";
}

/**
 * Los pedidos que se quedaron esperando un pago que nunca llegó.
 *
 * El link de Bold caduca a los `PAYMENT_WINDOW_MINUTES`; se deja un margen
 * por si el cliente pagó en el último minuto y el aviso viene en camino. Si
 * después de todo Bold avisa que se aprobó, `settlePayment` lo rescata.
 */
const GRACE_MINUTES = 5;

export async function expireStalePayments() {
  const limit = new Date(Date.now() - (PAYMENT_WINDOW_MINUTES + GRACE_MINUTES) * 60_000);
  await db
    .update(orders)
    .set({ status: "fallido", statusAt: sql`now()` })
    .where(and(eq(orders.status, "pago"), lt(orders.createdAt, limit)));
}

/** Lo mismo, pero para un solo pedido: lo usa la página de vuelta. */
export async function expireIfStale(orderId: string, createdAt: Date) {
  const limit = Date.now() - (PAYMENT_WINDOW_MINUTES + GRACE_MINUTES) * 60_000;
  if (createdAt.getTime() > limit) return false;
  await db
    .update(orders)
    .set({ status: "fallido", statusAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pago")));
  return true;
}

/**
 * Resolver un pedido en el momento en que alguien vuelve a mirarlo: la
 * página de vuelta de la tienda, el quiosco al volver de Bold, o el quiosco
 * esperando a que el cliente pague desde su celular.
 *
 * Si el pedido sigue en `pago` y tiene link, se le pregunta a Bold y se
 * aplica lo que diga; si además ya venció, se da por perdido. Devuelve el
 * estado en términos de la interfaz.
 */
export type ReturnState = "confirmed" | "pending" | "open" | "failed" | "waiting";

export async function resolveOrderReturn(orderId: string): Promise<{
  state: ReturnState;
  order: { id: string; status: string; total: number; mode: string; customerId: string | null } | null;
}> {
  const load = () =>
    db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        mode: orders.mode,
        customerId: orders.customerId,
        createdAt: orders.createdAt,
        paymentRef: orders.paymentRef,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

  let [row] = await load();
  if (!row) return { state: "failed", order: null };

  let state: ReturnState = row.status === "pago" ? "waiting" : "confirmed";

  if (row.status === "pago" && paymentsEnabled()) {
    if (row.paymentRef) {
      try {
        const result = await settlePayment(await lookupPayment(row.paymentRef));
        if (result === "pending" || result === "open") state = result;
      } catch (err) {
        // Bold no respondió: se queda en "esperando" y el webhook remata.
        console.warn("[bold] no se pudo consultar al volver:", err);
      }
    }
    await expireIfStale(row.id, row.createdAt);
    [row] = await load();
    if (!row) return { state: "failed", order: null };
  }

  if (row.status === "fallido") state = "failed";
  else if (row.status !== "pago") state = "confirmed";

  return {
    state,
    order: {
      id: row.id,
      status: row.status,
      total: row.total,
      mode: row.mode,
      customerId: row.customerId,
    },
  };
}

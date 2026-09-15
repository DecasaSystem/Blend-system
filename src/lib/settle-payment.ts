import "server-only";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { amountMatches, PAYMENT_WINDOW_MINUTES, type PaymentLookup } from "@/lib/payments";

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

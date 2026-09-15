"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { createOrder, type PlaceOrderInput } from "@/lib/create-order";
import { paymentsEnabled, startPayment } from "@/lib/payments";
import { getCustomer } from "@/lib/customer-session";

/**
 * Pagar en línea (Bold: tarjeta, PSE, Nequi, Botón Bancolombia).
 *
 * Se crea el pedido antes de mandar a la pasarela, en estado `pago`: así el
 * número existe desde el principio y viaja como referencia del cobro, pero la
 * barra no lo ve hasta que Bold confirme que entró la plata (al volver el
 * cliente, o por el webhook).
 */

export async function payWithCard(
  input: PlaceOrderInput,
): Promise<{ url: string } | { error: string }> {
  if (!paymentsEnabled()) {
    return { error: "El pago en línea no está disponible ahora mismo." };
  }

  const created = await createOrder(input, { payment: "tarjeta", awaitingPayment: true });
  if ("error" in created) return created;

  const customer = await getCustomer();
  const origin = await siteOrigin();

  try {
    // El monto se toma del pedido que acaba de guardar el servidor, no de lo
    // que mandó el navegador: es lo que se cobra.
    const { url, ref } = await startPayment({
      orderId: created.id,
      total: created.total,
      email: customer?.email,
      description: `Pedido ${created.id} · BLEND`,
      redirectUrl: `${origin}/checkout/listo?pedido=${created.id}`,
    });

    // El id del link es lo que Bold manda en el webhook y con lo que se
    // consulta el estado al volver: sin él, el pedido no se puede confirmar.
    await db.update(orders).set({ paymentRef: ref }).where(eq(orders.id, created.id));

    return { url };
  } catch (err) {
    // Sin link no hay forma de pagar este pedido: se cierra ya, en vez de
    // dejarlo media hora esperando un cobro que no puede llegar.
    await db
      .update(orders)
      .set({ status: "fallido", statusAt: new Date() })
      .where(eq(orders.id, created.id));

    return {
      error:
        err instanceof Error
          ? `No se pudo abrir el pago: ${err.message}`
          : "No se pudo abrir el pago.",
    };
  }
}

/** La URL pública, para que la pasarela sepa a dónde devolver al cliente. */
async function siteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function cardPaymentsAvailable() {
  return paymentsEnabled();
}

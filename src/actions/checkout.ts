"use server";

import { headers } from "next/headers";
import { createOrder, type PlaceOrderInput } from "@/lib/create-order";
import { paymentsEnabled, startPayment } from "@/lib/payments";
import { getCustomer } from "@/lib/customer-session";

/**
 * Pagar con tarjeta.
 *
 * Se crea el pedido antes de mandar a la pasarela, en estado `pago`: así el
 * número existe desde el principio y viaja como referencia del cobro, pero la
 * barra no lo ve hasta que el webhook confirme que entró la plata.
 */

export async function payWithCard(
  input: PlaceOrderInput,
): Promise<{ url: string } | { error: string }> {
  if (!paymentsEnabled()) {
    return { error: "El pago con tarjeta no está disponible ahora mismo." };
  }

  const created = await createOrder(input, { payment: "tarjeta", awaitingPayment: true });
  if ("error" in created) return created;

  const customer = await getCustomer();
  const origin = await siteOrigin();

  try {
    // El monto se toma del pedido que acaba de guardar el servidor, no de lo
    // que mandó el navegador: es lo que se cobra y lo que se firma.
    return startPayment({
      orderId: created.id,
      total: created.total,
      email: customer?.email,
      name: input.customer.name,
      phone: input.customer.phone,
      redirectUrl: `${origin}/checkout/listo?pedido=${created.id}`,
    });
  } catch (err) {
    // El pedido se queda en `pago` y nunca llega a la barra: no se prepara nada
    // que no se haya cobrado.
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

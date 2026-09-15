import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import PaymentResult, { type PaymentState } from "@/components/PaymentResult";
import { getCustomer } from "@/lib/customer-session";
import { lookupPayment, paymentsEnabled } from "@/lib/payments";
import { expireIfStale, settlePayment } from "@/lib/settle-payment";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Regreso desde la pasarela.
 *
 * El pedido guarda el id del link de Bold (`payment_ref`); con él se le
 * pregunta a Bold y el pedido se resuelve aquí mismo, en el instante en que el
 * cliente vuelve: no hay que esperar al webhook, que puede tardar (en modo
 * pruebas Bold ni siquiera lo manda solo).
 *
 * Volver aquí NO confirma nada por sí solo, y de la URL sólo se lee el número
 * de pedido: lo que confirma es la respuesta de Bold sobre el link que el
 * propio servidor creó, y sólo si el monto cuadra (`settlePayment`).
 *
 * Si el pago falló, el cliente vuelve al checkout con el carrito intacto para
 * intentarlo otra vez; aquí no hay nada que enseñarle.
 */
export default async function PagoListoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  if (!pedido) redirect("/");

  const load = () =>
    db
      .select({
        id: orders.id,
        status: orders.status,
        mode: orders.mode,
        total: orders.total,
        customerId: orders.customerId,
        createdAt: orders.createdAt,
        paymentRef: orders.paymentRef,
      })
      .from(orders)
      .where(eq(orders.id, pedido))
      .limit(1);

  let [row] = await load();
  if (!row) redirect("/");

  let state: PaymentState = row.status === "pago" ? "waiting" : "confirmed";

  if (row.status === "pago" && paymentsEnabled()) {
    if (row.paymentRef) {
      try {
        const tx = await lookupPayment(row.paymentRef);
        const result = await settlePayment(tx);
        if (result === "pending" || result === "open") state = result;
      } catch (err) {
        // Bold no respondió: se queda en "esperando" y el webhook remata.
        console.warn("[bold] no se pudo consultar al volver:", err);
      }
    }
    // Si sigue sin pagar y el enlace ya venció, no va a pagar.
    await expireIfStale(row.id, row.createdAt);
    [row] = await load();
    if (!row) redirect("/");
  }

  if (row.status === "fallido") redirect("/checkout?cancelado=1");
  if (row.status !== "pago") state = "confirmed";

  const customer = await getCustomer();

  /*
   * El id del pedido es secuencial (B-1043, B-1044…), así que cualquiera
   * podía recorrerlos y leer el monto y la modalidad de todos los pedidos de
   * la tienda, no solo el suyo. El monto y el modo sólo se enseñan si el
   * pedido es de la cuenta con sesión abierta; si no, la página confirma que
   * el pago se recibió, sin más detalle.
   */
  const propio = Boolean(customer && row.customerId === customer.id);

  return (
    <PaymentResult
      orderId={row.id}
      state={state}
      mode={propio ? row.mode : undefined}
      total={propio ? row.total : undefined}
      signedIn={Boolean(customer)}
    />
  );
}

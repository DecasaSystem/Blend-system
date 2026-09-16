import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PaymentResult from "@/components/PaymentResult";
import { getCustomer } from "@/lib/customer-session";
import { resolveOrderReturn } from "@/lib/settle-payment";

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
 * pruebas Bold ni siquiera lo manda solo). La lógica está en
 * `resolveOrderReturn`, compartida con el quiosco.
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

  const { state, order } = await resolveOrderReturn(pedido);
  if (!order) redirect("/");
  if (state === "failed") redirect("/checkout?cancelado=1");

  const customer = await getCustomer();

  /*
   * El id del pedido es secuencial (B-1043, B-1044…), así que cualquiera
   * podía recorrerlos y leer el monto y la modalidad de todos los pedidos de
   * la tienda, no solo el suyo. El monto y el modo sólo se enseñan si el
   * pedido es de la cuenta con sesión abierta; si no, la página confirma que
   * el pago se recibió, sin más detalle.
   */
  const propio = Boolean(customer && order.customerId === customer.id);

  return (
    <PaymentResult
      orderId={order.id}
      state={state}
      mode={propio ? (order.mode as "envio" | "recoger") : undefined}
      total={propio ? order.total : undefined}
      signedIn={Boolean(customer)}
    />
  );
}

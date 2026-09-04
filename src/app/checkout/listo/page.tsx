import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import PaymentResult from "@/components/PaymentResult";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = {
  title: "BLEND · Pedido confirmado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Regreso desde la pasarela.
 *
 * Volver aquí no confirma el cobro: eso lo hace el webhook, que es lo único
 * firmado por Stripe. Esta página sólo lee el estado del pedido, y si todavía
 * dice `pago` avisa de que puede tardar unos segundos.
 */
export default async function PagoListoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  if (!pedido) redirect("/");

  const [row] = await db
    .select({
      id: orders.id,
      status: orders.status,
      mode: orders.mode,
      total: orders.total,
      customerId: orders.customerId,
    })
    .from(orders)
    .where(eq(orders.id, pedido))
    .limit(1);

  if (!row) redirect("/");

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
      confirmed={row.status !== "pago"}
      mode={propio ? row.mode : undefined}
      total={propio ? row.total : undefined}
      signedIn={Boolean(customer)}
    />
  );
}

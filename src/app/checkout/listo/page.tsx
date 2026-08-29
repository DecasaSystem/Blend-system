import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import PaymentResult from "@/components/PaymentResult";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = { title: "BLEND · Pedido confirmado" };

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
    .select({ id: orders.id, status: orders.status, mode: orders.mode, total: orders.total })
    .from(orders)
    .where(eq(orders.id, pedido))
    .limit(1);

  if (!row) redirect("/");

  const customer = await getCustomer();

  return (
    <PaymentResult
      orderId={row.id}
      confirmed={row.status !== "pago"}
      mode={row.mode}
      total={row.total}
      signedIn={Boolean(customer)}
    />
  );
}

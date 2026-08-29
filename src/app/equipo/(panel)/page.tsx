import type { Metadata } from "next";
import OrderBoard from "@/components/team/OrderBoard";
import { listOrders } from "@/actions/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "BLEND · Barra",
  robots: { index: false, follow: false },
};

// Nunca cachear: el tablero muestra pedidos de ahora mismo.
export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const user = await requireUser();
  const orders = await listOrders();
  return <OrderBoard user={user} initialOrders={orders} />;
}

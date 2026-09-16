import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OrderBoard from "@/components/team/OrderBoard";
import { listOrders } from "@/actions/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Barra",
  robots: { index: false, follow: false },
};

// Nunca cachear: el tablero muestra pedidos de ahora mismo.
export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const user = await requireUser();
  // El repartidor tiene su propia pantalla; el tablero no es para él.
  if (user.role === "repartidor") redirect("/equipo/reparto");
  const orders = await listOrders();
  return <OrderBoard user={user} initialOrders={orders} />;
}

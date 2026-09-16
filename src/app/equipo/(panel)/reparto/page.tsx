import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DeliveryPanel from "@/components/team/DeliveryPanel";
import { myDeliveries } from "@/actions/delivery";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Reparto",
  robots: { index: false, follow: false },
};

// Entregas de ahora mismo: nunca cachear.
export const dynamic = "force-dynamic";

/**
 * La pantalla del repartidor: sus domicilios, con dirección, teléfono y lo
 * que lleva. Pensada para el celular en la moto. Un administrador también
 * puede entrar, para ver cómo va el reparto; la barra tiene su tablero.
 */
export default async function RepartoPage() {
  const user = await requireUser();
  if (user.role === "barra") redirect("/equipo");
  const board = await myDeliveries();
  return <DeliveryPanel user={user} initial={board} />;
}

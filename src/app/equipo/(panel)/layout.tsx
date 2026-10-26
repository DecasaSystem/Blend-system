import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

/**
 * Puerta de la vista de equipo.
 *
 * La comprobación vive aquí, en el servidor: nada de lo que hay dentro se
 * renderiza ni se envía al navegador sin sesión válida. Antes la clave viajaba
 * en el bundle y sólo escondía la interfaz.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Por /equipo/caducada, que borra la cookie vieja si la hay.
  if (!user) redirect("/equipo/caducada");
  return <>{children}</>;
}

import type { Metadata, Viewport } from "next";
import KioskLock from "@/components/kiosk/KioskLock";
import KioskOrder from "@/components/kiosk/KioskOrder";
import { getKioskSession } from "@/lib/kiosk";
import { kioskConfigured } from "@/lib/kiosk";
import { loadSiteContent } from "@/actions/content";

/**
 * Pantalla de autopedido del mostrador.
 *
 * No hay ningún enlace hacia aquí en toda la tienda: se llega escribiendo la
 * dirección. Eso no es la seguridad —la clave lo es— pero evita que un cliente
 * de la web tropiece con ella.
 */

export const metadata: Metadata = {
  title: "BLEND · Pide aquí",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#1B0B2E",
  width: "device-width",
  initialScale: 1,
  // Una pantalla de tienda no se pellizca para hacer zoom.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// La sede y la sesión se miran en cada visita, para que desconectar una
// pantalla desde /equipo tenga efecto inmediato.
export const dynamic = "force-dynamic";

export default async function QuioscoPage() {
  const sesion = await getKioskSession();
  const site = await loadSiteContent();

  if (!sesion) {
    return <KioskLock stores={site.stores} activo={await kioskConfigured()} />;
  }

  const tienda = site.stores.find((s) => s.id === sesion.storeId);
  return <KioskOrder tienda={tienda?.name ?? "Mostrador"} etiqueta={sesion.label} />;
}

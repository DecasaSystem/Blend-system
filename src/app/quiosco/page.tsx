import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import KioskLock from "@/components/kiosk/KioskLock";
import KioskOrder from "@/components/kiosk/KioskOrder";
import { getKioskSession } from "@/lib/kiosk";
import { kioskConfigured } from "@/lib/kiosk";
import { paymentsEnabled } from "@/lib/payments";
import { resolveOrderReturn } from "@/lib/settle-payment";
import { loadSiteContent } from "@/actions/content";

/**
 * Pantalla de autopedido del mostrador.
 *
 * No hay ningún enlace hacia aquí en toda la tienda: se llega escribiendo la
 * dirección. Eso no es la seguridad —la clave lo es— pero evita que un cliente
 * de la web tropiece con ella.
 */

export const metadata: Metadata = {
  title: "Pide aquí",
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

export default async function QuioscoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  const sesion = await getKioskSession();

  /*
   * `?pedido=` es la vuelta de Bold tras pagar en línea. Si llega sin sesión
   * de quiosco, quien vuelve no es la tablet sino el celular del cliente, que
   * pagó escaneando el QR: se le enseña la confirmación normal de la tienda,
   * no la pantalla de bloqueo de la tablet.
   */
  if (pedido && !sesion) redirect(`/checkout/listo?pedido=${encodeURIComponent(pedido)}`);

  const site = await loadSiteContent();

  if (!sesion) {
    return <KioskLock stores={site.stores} activo={await kioskConfigured()} />;
  }

  // La tablet volviendo de Bold: se resuelve el pedido aquí, como en la tienda.
  const vuelta = pedido ? await resolveOrderReturn(pedido) : null;

  const tienda = site.stores.find((s) => s.id === sesion.storeId);
  return (
    <KioskOrder
      tienda={tienda?.name ?? "Mostrador"}
      etiqueta={sesion.label}
      kiosk={site.kiosk}
      pagosEnLinea={paymentsEnabled() && site.kiosk.payOnline}
      vuelta={
        vuelta?.order
          ? { id: vuelta.order.id, state: vuelta.state, total: vuelta.order.total }
          : null
      }
    />
  );
}

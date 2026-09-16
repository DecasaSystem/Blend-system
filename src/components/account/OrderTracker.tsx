"use client";

import { useEffect, useRef, useState } from "react";
import CourierMap from "./CourierMap";
import { trackOrder, type Tracking } from "@/actions/tracking";
import { useNow } from "../team/useOrders";
import type { LatLng } from "@/lib/geo";

/**
 * «Tu pedido va en camino»: el mapa con la moto, dentro de la tarjeta del
 * pedido. Pregunta la posición cada pocos segundos mientras el pedido siga
 * en la calle; cuando el servidor dice que ya no (lo entregaron), avisa al
 * padre para que vuelva a pintar el pedido con su sello.
 *
 * Si el repartidor lleva más de un par de minutos sin mandar nada —celular
 * bloqueado, sin señal—, se dice tal cual, para que el punto quieto no
 * parezca que la moto se paró.
 */

const POLL_MS = 5000;
const STALE_AFTER_MS = 2 * 60 * 1000;

export default function OrderTracker({
  orderId,
  store,
  initial,
  onGone,
}: {
  orderId: string;
  store: LatLng & { name: string };
  initial?: Tracking | null;
  onGone: () => void;
}) {
  const [tracking, setTracking] = useState<Tracking | null>(initial ?? null);
  const now = useNow(1000);
  const inFlight = useRef(false);
  const gone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (inFlight.current || gone.current) return;
      inFlight.current = true;
      try {
        const next = await trackOrder(orderId);
        if (cancelled) return;
        if (!next) {
          gone.current = true;
          onGone();
          return;
        }
        setTracking(next);
      } catch {
        // Sin conexión: se queda lo último que se vio y se reintenta.
      } finally {
        inFlight.current = false;
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `onGone` se lee una vez; el padre no lo cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fix = tracking?.fix ?? null;
  const ageMs = fix ? now - fix.at : 0;
  const stale = fix ? ageMs > STALE_AFTER_MS : false;
  const name = tracking?.courierName?.split(" ")[0] ?? "Tu repartidor";

  return (
    <div className="mt-3 border-t-[1.5px] border-ink/10 pt-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">
          <span aria-hidden="true">🛵 </span>
          {name} va en camino
        </span>
        <span className={`u-mono ${stale ? "text-mango-deep" : "text-ink/45"}`}>
          {!fix
            ? "Esperando su ubicación…"
            : stale
              ? `Sin señal hace ${Math.round(ageMs / 60000)} min`
              : ageMs < 15000
                ? "En vivo"
                : `Hace ${Math.round(ageMs / 1000)} s`}
        </span>
      </p>
      <div className="mt-2">
        <CourierMap store={store} courier={fix} />
      </div>
    </div>
  );
}

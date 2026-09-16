"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { CupLoader } from "../CupLoader";
import { pinArt } from "../StoreMap";
import { useSite } from "../SiteProvider";
import { MAP_STYLE_URL, MAP_WORKER_URL, type LatLng } from "@/lib/geo";

/**
 * El mapa del domicilio: la sede de la que salió y la moto acercándose.
 *
 * Misma receta que `StoreMap` (MapLibre, teselas de OpenFreeMap, worker desde
 * /public), pero sin mapa ilustrado debajo: aquí sólo se enseña cuando hay
 * un repartidor en la calle, y lo que importa es el punto que se mueve.
 *
 * El encuadre se ajusta una vez, a las dos cosas. Después el mapa sigue a la
 * moto sólo si se sale de la vista: si el cliente acercó o movió el mapa, no
 * se le pelea.
 */

type Fix = LatLng & { heading: number | null };

export default function CourierMap({
  store,
  courier,
}: {
  store: LatLng & { name: string };
  /** Nulo mientras el celular del repartidor no ha mandado nada. */
  courier: Fix | null;
}) {
  const { brand } = useSite();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const courierMarker = useRef<Marker | null>(null);
  const fitted = useRef(false);
  const [status, setStatus] = useState<"cargando" | "listo" | "falló">("cargando");

  // 1. Crear el mapa, con el pin de la sede.
  useEffect(() => {
    if (!host.current) return;
    let instance: MapLibreMap | null = null;
    let disposed = false;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !host.current) return;
        maplibre.setWorkerUrl(MAP_WORKER_URL);

        instance = new maplibre.Map({
          container: host.current,
          style: MAP_STYLE_URL,
          center: [store.lng, store.lat],
          zoom: 14,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.current = instance;
        instance.touchZoomRotate.disableRotation();
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        instance.scrollZoom.disable();

        const pin = document.createElement("div");
        pin.className = "blend-pin";
        // Es la única sede del mapa: «activa» para que en móvil se lea su nombre.
        pin.dataset.active = "true";
        pin.append(pinArt(brand.logo));
        const label = document.createElement("span");
        label.className = "blend-pin-label";
        label.textContent = store.name;
        pin.append(label);
        new maplibre.Marker({ element: pin, anchor: "bottom" })
          .setLngLat([store.lng, store.lat])
          .addTo(instance);

        instance.on("load", () => {
          if (!disposed) setStatus("listo");
        });
        instance.on("error", () => {
          if (!disposed && !instance?.loaded()) setStatus("falló");
        });
      } catch {
        if (!disposed) setStatus("falló");
      }
    })();

    return () => {
      disposed = true;
      instance?.remove();
      if (map.current === instance) map.current = null;
      courierMarker.current = null;
      fitted.current = false;
    };
    // La sede no cambia mientras el pedido vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. La moto: se crea la primera vez, después sólo se mueve.
  useEffect(() => {
    const instance = map.current;
    if (status !== "listo" || !instance || !courier) return;
    let cancelled = false;

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !map.current) return;

      const lngLat: [number, number] = [courier.lng, courier.lat];
      if (!courierMarker.current) {
        const el = document.createElement("div");
        el.className = "blend-courier";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "Tu repartidor");
        el.innerHTML = `<span class="blend-courier-halo"></span><span class="blend-courier-dot">🛵</span>`;
        courierMarker.current = new maplibre.Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(instance);
      } else {
        courierMarker.current.setLngLat(lngLat);
      }

      if (!fitted.current) {
        fitted.current = true;
        const padding = instance.getContainer().clientWidth < 640 ? 56 : 80;
        instance.fitBounds(
          [
            [Math.min(store.lng, courier.lng), Math.min(store.lat, courier.lat)],
            [Math.max(store.lng, courier.lng), Math.max(store.lat, courier.lat)],
          ],
          { padding, maxZoom: 16, duration: 0 },
        );
      } else if (!instance.getBounds().contains(lngLat)) {
        instance.easeTo({ center: lngLat, duration: 700 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, courier, store.lat, store.lng]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-[1.5px] border-ink/15 bg-paper-2 sm:aspect-[16/9]">
      <div
        ref={host}
        className={`blend-map absolute inset-0 transition-opacity duration-700 ${
          status === "listo" ? "opacity-100" : "opacity-0"
        }`}
      />
      {status === "cargando" ? (
        <p className="u-mono absolute left-3 top-3 flex items-center gap-1.5 rounded-full border-[1.5px] border-ink/15 bg-paper/90 px-3 py-1.5 text-ink/45 backdrop-blur">
          <CupLoader size={14} /> Cargando el mapa…
        </p>
      ) : null}
      {status === "falló" ? (
        <p className="u-mono absolute inset-x-3 top-3 rounded-full border-[1.5px] border-ink/15 bg-paper/90 px-3 py-1.5 text-center text-ink/45 backdrop-blur">
          No se pudo cargar el mapa
        </p>
      ) : null}
    </div>
  );
}

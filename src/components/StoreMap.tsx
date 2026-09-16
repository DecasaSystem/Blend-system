"use client";

import { useEffect, useRef, useState } from "react";
import { CupLoader } from "@/components/CupLoader";
import { useSite } from "./SiteProvider";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import IllustratedMap from "./IllustratedMap";
import { boundsOf, CITY_CENTER, MAP_STYLE_URL, MAP_WORKER_URL } from "@/lib/geo";
import type { Store } from "@/lib/content";

/**
 * Mapa real con MapLibre.
 *
 * - Se descarga sólo cuando la sección entra en pantalla: son ~200 KB que no
 *   deben pesar en la carga inicial de la tienda.
 * - Mientras llega, y si falla, se ve el mapa ilustrado. Nunca queda un hueco.
 * - Los pines son elementos del DOM, no del lienzo, así que el filtro que tiñe
 *   las teselas no los toca.
 */

export default function StoreMap({
  stores,
  activeId,
  onSelect,
}: {
  stores: Store[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const { brand } = useSite();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const [status, setStatus] = useState<"esperando" | "cargando" | "listo" | "falló">("esperando");
  // Disparador de carga, separado del estado que pinta la UI: si el efecto que
  // crea el mapa dependiera de `status`, al pasar a "listo" se destruiría solo.
  const [shouldLoad, setShouldLoad] = useState(false);

  // Callbacks frescos sin recrear el mapa en cada render.
  const select = useRef(onSelect);
  select.current = onSelect;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // 1. Sólo cargar cuando la sección se acerca a la pantalla.
  useEffect(() => {
    const el = host.current;
    if (!el || shouldLoad) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          setStatus("cargando");
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoad]);

  // 2. Crear el mapa.
  //    El mapa se guarda en cuanto se construye, no al terminar de cargar: en
  //    desarrollo React monta los efectos dos veces y con el patrón contrario
  //    la primera instancia se quedaba a medias y el evento `load` se perdía.
  useEffect(() => {
    if (!shouldLoad || !host.current) return;

    let instance: MapLibreMap | null = null;
    let disposed = false;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !host.current) return;

        // El worker se sirve desde /public (ver scripts/setup-maplibre.mjs).
        // Sin esto MapLibre lo busca en `import.meta.url`, que tras el bundler
        // apunta a la propia página: el worker se queda mudo y el mapa nunca
        // termina de cargar, sin dar ningún error.
        maplibre.setWorkerUrl(MAP_WORKER_URL);

        instance = new maplibre.Map({
          container: host.current,
          style: MAP_STYLE_URL,
          center: CITY_CENTER,
          zoom: 11,
          attributionControl: { compact: true },
          // Sin rotación: en un mapa de sucursales sólo estorba.
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.current = instance;

        instance.touchZoomRotate.disableRotation();
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        // El scroll de la página no debe quedarse atrapado en el mapa.
        instance.scrollZoom.disable();

        instance.on("load", () => {
          if (!disposed) setStatus("listo");
        });
        instance.on("error", () => {
          // Un fallo después de cargar es una tesela suelta, no el mapa entero.
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
    };
  }, [shouldLoad]);

  // 3. Pines: se crean y se retiran según la lista de sedes.
  useEffect(() => {
    const instance = map.current;
    if (status !== "listo" || !instance) return;
    let cancelled = false;

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !map.current) return;

      const seen = new Set(stores.map((s) => s.id));
      for (const [id, marker] of markers.current) {
        if (!seen.has(id)) {
          marker.remove();
          markers.current.delete(id);
        }
      }

      for (const store of stores) {
        const existing = markers.current.get(store.id);
        if (existing) {
          existing.setLngLat([store.lng, store.lat]);
          continue;
        }
        const el = pinElement(store, brand.logo);
        // Marcar aquí también: el efecto de resaltado puede haber corrido antes
        // de que este pin existiera.
        el.dataset.active = String(store.id === activeIdRef.current);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          select.current(store.id);
        });
        const marker = new maplibre.Marker({ element: el, anchor: "bottom" })
          .setLngLat([store.lng, store.lat])
          .addTo(instance);
        markers.current.set(store.id, marker);
      }

      const box = boundsOf(stores);
      if (box) {
        // Menos margen en pantallas chicas: si no, las sedes se apiñan al centro.
        const padding = instance.getContainer().clientWidth < 640 ? 44 : 70;
        instance.fitBounds([box.sw, box.ne], { padding, maxZoom: 14, duration: 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, stores, brand.logo]);

  // 4. Resaltar la seleccionada y volar hasta ella.
  useEffect(() => {
    if (status !== "listo") return;
    for (const [id, marker] of markers.current) {
      marker.getElement().dataset.active = String(id === activeId);
    }
    const store = stores.find((s) => s.id === activeId);
    if (store && map.current) {
      map.current.easeTo({ center: [store.lng, store.lat], duration: 700, zoom: 14 });
    }
  }, [activeId, status, stores]);

  return (
    // `absolute inset-0`, no `h-full`: un alto en porcentaje contra un padre que
    // saca su altura de `aspect-ratio` se resuelve a 0 y MapLibre nunca renderiza.
    <div className="absolute inset-0">
      {/* El mapa dibujado se queda debajo: se ve mientras carga y si falla.
          Cuando el real toma el relevo, deja de ser navegable: si no, el teclado
          seguiría entrando en pines invisibles. */}
      <div className="absolute inset-0" aria-hidden={status === "listo"}>
        <IllustratedMap
          stores={stores}
          activeId={activeId}
          onSelect={onSelect}
          interactive={status !== "listo"}
        />
      </div>

      <div
        ref={host}
        className={`blend-map absolute inset-0 transition-opacity duration-700 ${
          status === "listo" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={status !== "listo"}
      />

      {status === "cargando" ? (
        <p className="u-mono absolute left-3 top-3 flex items-center gap-1.5 rounded-full border-[1.5px] border-ink/15 bg-paper/90 px-3 py-1.5 text-ink/45 backdrop-blur">
          <CupLoader size={14} /> Cargando el mapa…
        </p>
      ) : null}

      {status === "falló" ? (
        <p className="u-mono absolute left-3 top-3 rounded-full border-[1.5px] border-ink/15 bg-paper/90 px-3 py-1.5 text-ink/45 backdrop-blur">
          Mapa ilustrado · sin conexión
        </p>
      ) : null}
    </div>
  );
}

/**
 * Marca del pin: halo, cola y el aro de tinta. Cadena fija: aquí no entra nada
 * que escriba el equipo. Las tres tintas van dentro sólo si no hay logo.
 */
const PIN_SVG = (inks: boolean) => `
  <svg width="42" height="52" viewBox="0 0 42 52" aria-hidden="true">
    <g class="blend-pin-halo">
      <circle cx="21" cy="19" r="20" fill="#1B0B2E" opacity="0.14" />
    </g>
    <path d="M21 50 L15 39 L27 39 Z" fill="#1B0B2E" />
    <circle cx="21" cy="19" r="15.5" fill="#FFFDFB" />
    ${
      inks
        ? `<g style="mix-blend-mode:multiply" transform="translate(21 19)">
      <circle cx="-5" cy="-4" r="9" fill="#FF6A1A" />
      <circle cx="5" cy="-3.5" r="9" fill="#7B3FF2" />
      <circle cx="0" cy="4.5" r="9" fill="#8FD14F" />
    </g>`
        : ""
    }
    <circle cx="21" cy="19" r="15.5" fill="none" stroke="#1B0B2E" stroke-width="2" />
  </svg>
`;

/**
 * El dibujo del pin. Con logo, va el logo recortado en círculo, como en la
 * cabecera; si no, las tres tintas. La URL del logo la sube el equipo, así
 * que se pone por atributo y nunca dentro del marcado.
 */
export function pinArt(logo: string | null | undefined) {
  const wrap = document.createElement("span");
  wrap.innerHTML = PIN_SVG(!logo);
  const svg = wrap.firstElementChild as SVGSVGElement;
  if (logo) {
    const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", logo);
    // Un poco más grande que el aro: el archivo trae un margen casi blanco.
    img.setAttribute("x", "5");
    img.setAttribute("y", "3");
    img.setAttribute("width", "32");
    img.setAttribute("height", "32");
    img.setAttribute("preserveAspectRatio", "xMidYMid slice");
    img.style.clipPath = "circle(14.5px at 16px 16px)";
    // Debajo del aro de tinta, que es el último hijo.
    svg.insertBefore(img, svg.lastElementChild);
  }
  return svg;
}

/** El mismo pin que dibuja el mapa ilustrado. */
function pinElement(store: Store, logo: string | null | undefined) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "blend-pin";
  el.setAttribute("aria-label", `Ver ${store.name}`);
  el.append(pinArt(logo));

  // El nombre de la zona lo escribe el equipo: va por textContent, nunca por
  // innerHTML, para que no pueda inyectar marcado.
  const label = document.createElement("span");
  label.className = "blend-pin-label";
  label.textContent = store.area;
  el.append(label);

  return el;
}

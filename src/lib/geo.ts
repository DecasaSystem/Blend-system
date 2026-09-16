import type { Store } from "./content";

/**
 * Proyección del mapa ilustrado. El equipo edita lat/lng una sola vez y los dos
 * mapas —el real y el dibujado— salen de ahí.
 */

/**
 * Recuadro de Armenia, ajustado a las dos sedes con margen suficiente para que
 * ningún pin acabe pegado al borde del mapa dibujado.
 */
export const CITY_BOUNDS = {
  north: 4.578,
  south: 4.512,
  west: -75.678,
  east: -75.634,
};

export const CITY_CENTER: [number, number] = [
  (CITY_BOUNDS.west + CITY_BOUNDS.east) / 2,
  (CITY_BOUNDS.north + CITY_BOUNDS.south) / 2,
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** lat/lng → coordenadas 0–100 del lienzo ilustrado. */
export function project(store: Pick<Store, "lat" | "lng">) {
  const { north, south, west, east } = CITY_BOUNDS;
  return {
    // Margen: los pines miden ~9 unidades y la etiqueta cuelga debajo.
    x: clamp(((store.lng - west) / (east - west)) * 100, 8, 92),
    y: clamp(((north - store.lat) / (north - south)) * 100, 10, 66),
  };
}

/** Recuadro que encuadra todas las sedes, para el encuadre inicial del mapa real. */
export function boundsOf(stores: Store[]) {
  if (stores.length === 0) return null;
  const lats = stores.map((s) => s.lat);
  const lngs = stores.map((s) => s.lng);
  return {
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
  };
}

/** Punto en el mapa. La misma forma que manda el chat y que guarda el reparto. */
export type LatLng = { lat: number; lng: number };

/** OpenFreeMap: teselas libres, sin clave ni cuota. Atribución obligatoria. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** El worker de MapLibre; lo copia scripts/setup-maplibre.mjs antes de `dev` y de `build`. */
export const MAP_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** Metros entre dos puntos (haversine). Suficiente para «¿se movió la moto?». */
export function distanceMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

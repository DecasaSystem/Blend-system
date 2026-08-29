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

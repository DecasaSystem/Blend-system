import type { Topping } from "./site";

/**
 * Modelo del pedido. Un solo lugar calcula precios y arma la etiqueta que
 * verá la barra, para que el carrito, el checkout y la vista de equipo digan
 * exactamente lo mismo.
 */

export const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export const SIZES = [
  { id: "chico", label: "Chico", volume: "350 ml", delta: 0 },
  { id: "grande", label: "Grande", volume: "500 ml", delta: 4500 },
] as const;

export const SWEETNESS = [
  { id: "sin", label: "Sin miel" },
  { id: "normal", label: "Como va" },
  { id: "extra", label: "Extra dulce" },
] as const;

export type SizeId = (typeof SIZES)[number]["id"];
export type SweetId = (typeof SWEETNESS)[number]["id"];

export type LineOptions = {
  size: SizeId;
  base: string;
  sweet: SweetId;
  extras: string[];
  note: string;
};

export type CartLine = {
  key: string;
  productId: string;
  name: string;
  color: string;
  /** Precio unitario ya con tamaño y toppings. */
  unitPrice: number;
  /** Precio del producto antes de opciones. Con oferta del día, el rebajado. */
  basePrice: number;
  /** Precio de lista, solo para tachar cuando hay oferta. */
  listPrice?: number;
  qty: number;
  options?: LineOptions;
  /** Ingredientes elegidos en "Arma tu blend". */
  custom?: string[];
  offerLabel?: string;
  /** Tope de unidades cuando queda poco inventario. */
  maxQty?: number;
  /** Se guarda para poder reconstruir la clave al editar la línea. */
  keySuffix?: string;
};

export type DeliveryMode = "envio" | "recoger";

export const DELIVERY_FEE = 6900;
export const FREE_DELIVERY_FROM = 60000;
export const MAX_QTY = 20;

export const defaultOptions = (base: string): LineOptions => ({
  size: "chico",
  base,
  sweet: "normal",
  extras: [],
  note: "",
});

/** Los toppings los edita el equipo, así que el precio siempre viene de fuera. */
export function toppingPrice(name: string, toppings: Topping[]) {
  return toppings.find((t) => t.name === name)?.price ?? 0;
}

/** Precio unitario a partir del precio base del producto y sus opciones. */
export function unitPrice(basePrice: number, options: LineOptions | undefined, toppings: Topping[]) {
  if (!options) return basePrice;
  const size = SIZES.find((s) => s.id === options.size)?.delta ?? 0;
  const extras = options.extras.reduce((n, name) => n + toppingPrice(name, toppings), 0);
  return basePrice + size + extras;
}

/**
 * Identidad de la línea. Dos veces el mismo producto con las mismas opciones
 * se suman; con una coma distinta en las notas, son líneas separadas.
 */
export function lineKey(productId: string, options?: LineOptions, suffix = "") {
  if (!options) return `${productId}${suffix ? `|${suffix}` : ""}`;
  const parts = [
    productId,
    options.size,
    options.base,
    options.sweet,
    [...options.extras].sort().join("+"),
    options.note.trim().toLowerCase(),
    suffix,
  ];
  return parts.join("|");
}

/** Lo que lee la barra en el ticket. */
export function describe(line: CartLine): string {
  if (line.custom) return line.custom.join(", ");
  const o = line.options;
  if (!o) return "";
  const size = SIZES.find((s) => s.id === o.size);
  const sweet = SWEETNESS.find((s) => s.id === o.sweet);
  return [
    size && `${size.label} ${size.volume}`,
    o.base,
    o.sweet !== "normal" ? sweet?.label : null,
    ...o.extras,
    o.note.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function totals(lines: CartLine[], mode: DeliveryMode) {
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);
  const freeDelivery = subtotal >= FREE_DELIVERY_FROM;
  const delivery = mode === "recoger" || subtotal === 0 || freeDelivery ? 0 : DELIVERY_FEE;
  const missingForFree = Math.max(0, FREE_DELIVERY_FROM - subtotal);
  return { count, subtotal, delivery, total: subtotal + delivery, freeDelivery, missingForFree };
}


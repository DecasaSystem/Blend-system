import type { Pricing, Size } from "./content";
import type { SiteContent, Topping } from "./site";

/**
 * Modelo del pedido. Un solo lugar calcula precios y arma la etiqueta que
 * verá la barra, para que el carrito, el checkout y la vista de equipo digan
 * exactamente lo mismo.
 *
 * Los tamaños, el domicilio y los toppings los edita el equipo, así que ninguna
 * de estas funciones lleva precios dentro: todos entran por parámetro desde el
 * contenido publicado.
 */

export const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export const SWEETNESS = [
  { id: "sin", label: "Sin miel" },
  { id: "normal", label: "Como va" },
  { id: "extra", label: "Extra dulce" },
] as const;

/** El id del tamaño elegido. Es texto libre porque el equipo crea los tamaños. */
export type SizeId = string;
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

export const MAX_QTY = 20;

export const defaultOptions = (base: string, size: string): LineOptions => ({
  size,
  base,
  sweet: "normal",
  extras: [],
  note: "",
});

/** Los toppings los edita el equipo, así que el precio siempre viene de fuera. */
export function toppingPrice(name: string, toppings: Topping[]) {
  return toppings.find((t) => t.name === name)?.price ?? 0;
}

/** Lo que suma el tamaño elegido. Un tamaño que ya no existe no cobra de más. */
export function sizeDelta(id: string | undefined, sizes: Size[]) {
  return sizes.find((s) => s.id === id)?.delta ?? 0;
}

/**
 * Lo que cuesta una bebida en un vaso concreto.
 *
 * El precio vive en la bebida, por tamaño. El recargo global de `sizes` sólo
 * entra como respaldo: cuando el equipo crea un tamaño nuevo, ninguna bebida
 * tiene precio para él todavía, y sin este respaldo el menú entero se quedaría
 * a cero hasta rellenarlas una a una.
 */
export function priceOf(
  product: { prices?: Record<string, number>; price?: number },
  sizeId: string | undefined,
  sizes: Size[],
) {
  const propio = sizeId ? product.prices?.[sizeId] : undefined;
  if (typeof propio === "number") return propio;

  // Sin precio para ese vaso: se parte del primero que tenga y se le aplica la
  // diferencia de recargos entre los dos tamaños.
  const base = product.prices?.[sizes[0]?.id ?? ""] ?? product.price ?? 0;
  return base + sizeDelta(sizeId, sizes) - sizeDelta(sizes[0]?.id, sizes);
}

/** El precio con el que se anuncia en el menú: el del vaso más barato. */
export function fromPrice(product: { prices?: Record<string, number>; price?: number }) {
  const valores = Object.values(product.prices ?? {});
  if (valores.length > 0) return Math.min(...valores);
  return product.price ?? 0;
}

/**
 * Precio unitario.
 *
 * `basePrice` ya viene resuelto para el vaso elegido —lo hace `priceOf`—, así
 * que aquí sólo se suman los adicionales. Antes se sumaba también el recargo
 * del tamaño; ahora eso lo cobraría dos veces.
 */
export function unitPrice(
  basePrice: number,
  options: LineOptions | undefined,
  toppings: Topping[],
) {
  if (!options) return basePrice;
  return basePrice + options.extras.reduce((n, name) => n + toppingPrice(name, toppings), 0);
}

/**
 * El precio del día en un vaso concreto.
 *
 * La oferta se fija sobre el vaso más pequeño; los demás mantienen la misma
 * diferencia que tienen a precio de lista. Así rebajar el chico no regala el
 * grande ni al revés.
 */
export function offerPriceOf(
  product: { prices?: Record<string, number>; price?: number },
  offerBase: number,
  sizeId: string | undefined,
  sizes: Size[],
) {
  return offerBase + priceOf(product, sizeId, sizes) - priceOf(product, sizes[0]?.id, sizes);
}

/** Precio de un blend armado a mano: base más el recargo por cada extra. */
export function builderPrice(ingredients: number, pricing: Pricing) {
  return pricing.builder.base + Math.max(0, ingredients - 2) * pricing.builder.perExtra;
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

/**
 * Lo que lee la barra en el ticket.
 *
 * `sizes` es opcional a propósito: un pedido de hace un mes puede llevar un
 * tamaño que el equipo ya borró. Entonces se escribe el id tal cual en vez de
 * perder el dato.
 */
export function describe(line: CartLine, sizes: Size[] = []): string {
  if (line.custom) return line.custom.join(", ");
  const o = line.options;
  if (!o) return "";
  const size = sizes.find((s) => s.id === o.size);
  const sweet = SWEETNESS.find((s) => s.id === o.sweet);
  return [
    size ? `${size.label} ${size.volume}` : o.size,
    o.base,
    o.sweet !== "normal" ? sweet?.label : null,
    ...o.extras,
    o.note.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Vuelve a armar las líneas del pedido contra el contenido publicado.
 *
 * Lo que llega del navegador es una intención de compra, no una factura: el
 * nombre, el color y el precio unitario que trae se descartan y se calculan de
 * nuevo aquí. Sin esto, cambiar `unitPrice` en el navegador antes de pagar
 * bastaría para llevarse el pedido por lo que uno quisiera.
 */
export function repriceLines(
  lines: CartLine[],
  site: SiteContent,
): { lines: CartLine[] } | { error: string } {
  const out: CartLine[] = [];

  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) return { error: "Hay una cantidad que no es válida." };

    // Blend armado a mano: no existe en el catálogo, se cotiza por ingredientes.
    if (line.custom) {
      const [baseName, ...picked] = line.custom;
      const base = site.builderBases.find((b) => b.name === baseName);
      const known = picked.filter((n) => site.builderIngredients.some((i) => i.name === n));
      if (!base || known.length === 0 || known.length !== picked.length) {
        return { error: "Uno de los blends que armaste ya no está disponible." };
      }
      const price = builderPrice(known.length, site.pricing);
      out.push({
        ...line,
        unitPrice: price,
        basePrice: price,
        listPrice: undefined,
        offerLabel: undefined,
        qty: Math.min(qty, MAX_QTY),
      });
      continue;
    }

    const product = site.products.find((p) => p.id === line.productId);
    if (!product) return { error: `«${line.name}» ya no está en el menú.` };
    if (product.soldOut) return { error: `«${product.name}» se agotó.` };

    // La oferta del día sólo vale si sigue publicada y aún quedan unidades.
    const onOffer = line.keySuffix === "dia";
    const offer = site.dailyOffer[product.id];
    const offerValid = onOffer && site.dailyIds.includes(product.id) && offer && offer.left > 0;
    if (onOffer && !offerValid) return { error: `La oferta de «${product.name}» ya terminó.` };

    const cap = Math.min(offerValid ? offer.left : MAX_QTY, MAX_QTY);

    // Un topping o un tamaño que el equipo borró no puede seguir cobrándose.
    const options = line.options
      ? {
          ...line.options,
          extras: line.options.extras.filter((n) => site.toppings.some((t) => t.name === n)),
          note: String(line.options.note ?? "").slice(0, 140),
        }
      : undefined;

    // El precio sale del vaso pedido, no de un precio único del producto.
    const lista = priceOf(product, options?.size, site.sizes);
    const basePrice = offerValid
      ? offerPriceOf(product, offer.price, options?.size, site.sizes)
      : lista;

    out.push({
      ...line,
      name: product.name,
      color: product.color,
      options,
      basePrice,
      listPrice: offerValid ? lista : undefined,
      offerLabel: offerValid ? "Precio del día" : undefined,
      maxQty: offerValid ? offer.left : undefined,
      unitPrice: unitPrice(basePrice, options, site.toppings),
      qty: Math.min(qty, cap),
    });
  }

  return { lines: out };
}

export function totals(lines: CartLine[], mode: DeliveryMode, pricing: Pricing) {
  const { fee, freeFrom } = pricing.delivery;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);
  const freeDelivery = subtotal >= freeFrom;
  const delivery = mode === "recoger" || subtotal === 0 || freeDelivery ? 0 : fee;
  const missingForFree = Math.max(0, freeFrom - subtotal);
  return { count, subtotal, delivery, total: subtotal + delivery, freeDelivery, missingForFree };
}

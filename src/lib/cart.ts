import type { BuilderConfig, Category, Pricing, Size } from "./content";
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
  /**
   * Opciones de la bebida. En un blend armado a mano sólo cuentan la base, los
   * adicionales y la nota: el tamaño va vacío porque el constructor cobra un
   * precio único.
   */
  options?: LineOptions;
  /** Base y luego ingredientes elegidos en "Arma tu blend". */
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

/*
 * Precios por tamaño.
 *
 * El vaso no cuesta: es sólo un tamaño (12 oz, 16 oz…) que comparte todo el
 * menú. Lo que cuesta es la bebida en ese tamaño, y normalmente lo decide su
 * categoría: todas las limonadas de 12 oz valen lo mismo, y una granola de
 * 12 oz vale otra cosa. Por eso el precio se busca en este orden:
 *
 *   1. La bebida, si tiene «precio propio» (`ownPrices`): una excepción a su
 *      categoría.
 *   2. Su categoría, si tiene precios: manda en todos los tamaños, y uno que
 *      deje vacío no se vende en esa categoría.
 *   3. La bebida, aunque no tenga la marca, sólo si su categoría no tiene
 *      ningún precio: así estaban todos antes de que existieran los de
 *      categoría, y siguen valiendo hasta que el equipo los ponga.
 *
 * Si no hay precio en ninguno, esa bebida no se vende en ese tamaño: no se
 * ofrece en la ficha y el servidor no lo cobra. Antes se inventaba con un
 * «recargo» del vaso, y eso podía cobrar un precio que nadie decidió.
 */

/** Lo que hace falta para poner precio: los tamaños y las categorías publicadas. */
export type PriceCtx = { sizes: Size[]; categories: Category[] };

type Priced = {
  category: string;
  prices?: Record<string, number>;
  price?: number;
  ownPrices?: boolean;
};

const isPrice = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** El precio de una bebida en un tamaño, o null si no se vende en ese tamaño. */
export function sizePrice(product: Priced, sizeId: string | undefined, ctx: PriceCtx): number | null {
  if (!sizeId || !ctx.sizes.some((s) => s.id === sizeId)) return null;
  const own = product.prices?.[sizeId];
  if (product.ownPrices) return isPrice(own) ? own : null;
  // Si la categoría tiene precios, manda en todos los tamaños: uno vacío es
  // uno que esa categoría no vende, no un hueco para colar el precio viejo.
  const cat = ctx.categories.find((c) => c.id === product.category)?.prices;
  if (cat && Object.values(cat).some(isPrice)) {
    const v = cat[sizeId];
    return isPrice(v) ? v : null;
  }
  if (isPrice(own)) return own;
  // Bebidas de antes de los precios por tamaño: un precio único, sólo en el primer vaso.
  if (!product.prices && isPrice(product.price) && sizeId === ctx.sizes[0]?.id) return product.price;
  return null;
}

/** Los tamaños en que se vende una bebida, en el orden del equipo. */
export function sizesFor(product: Priced, ctx: PriceCtx): Size[] {
  return ctx.sizes.filter((s) => sizePrice(product, s.id, ctx) !== null);
}

/** El tamaño que viene marcado al pedir: el primero en que se vende. */
export function firstSizeId(product: Priced, ctx: PriceCtx): string {
  return sizesFor(product, ctx)[0]?.id ?? "";
}

/**
 * Lo que cuesta una bebida en un tamaño. Si no se vende en ese, el del
 * primer tamaño en que sí: para pintar algo razonable mientras se elige.
 * Para cobrar, el servidor usa `sizePrice` y rechaza el tamaño sin precio.
 */
export function priceOf(product: Priced, sizeId: string | undefined, ctx: PriceCtx): number {
  return sizePrice(product, sizeId, ctx) ?? sizePrice(product, firstSizeId(product, ctx), ctx) ?? 0;
}

/** El precio con el que se anuncia en el menú: el del tamaño más barato. */
export function fromPrice(product: Priced, ctx: PriceCtx): number {
  const all = sizesFor(product, ctx).map((s) => sizePrice(product, s.id, ctx) as number);
  return all.length > 0 ? Math.min(...all) : 0;
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
 * La oferta se fija sobre el primer tamaño en que se vende la bebida; los
 * demás mantienen la misma diferencia que tienen a precio de lista. Así
 * rebajar el pequeño no regala el grande ni al revés.
 */
export function offerPriceOf(
  product: Priced,
  offerBase: number,
  sizeId: string | undefined,
  ctx: PriceCtx,
) {
  return offerBase + priceOf(product, sizeId, ctx) - priceOf(product, firstSizeId(product, ctx), ctx);
}

/**
 * Precio de un blend armado a mano, antes de adicionales: el precio base cubre
 * `included` ingredientes y cada uno de más suma el recargo.
 */
export function builderPrice(ingredients: number, pricing: Pricing, rules: BuilderConfig) {
  return (
    pricing.builder.base + Math.max(0, ingredients - rules.included) * pricing.builder.perExtra
  );
}

/** Opciones de un blend armado: sin tamaño ni dulzor, sólo lo que se cobra y se lee. */
export const builderOptions = (base: string, extras: string[], note = ""): LineOptions => ({
  size: "",
  base,
  sweet: "normal",
  extras,
  note,
});

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
  const o = line.options;
  // Blend armado: la receta va junta y los adicionales después, como en el resto.
  if (line.custom) {
    return [line.custom.join(", "), ...(o?.extras ?? []), o?.note?.trim()]
      .filter(Boolean)
      .join(" · ");
  }
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

    // Blend armado a mano: no existe en el catálogo, se cotiza por ingredientes
    // con las reglas publicadas. Ni un ingrediente repetido ni uno de más
    // pasan: el navegador sólo puede pedir lo que la sección deja elegir.
    if (line.custom) {
      const [baseName, ...picked] = Array.isArray(line.custom) ? line.custom : [];
      const base = site.builderBases.find((b) => b.name === baseName);
      const known = picked.filter((n) => site.builderIngredients.some((i) => i.name === n));
      const repeated = new Set(picked).size !== picked.length;
      if (
        !base ||
        known.length === 0 ||
        known.length !== picked.length ||
        repeated ||
        picked.length > site.builder.max
      ) {
        return { error: "Uno de los blends que armaste ya no está disponible." };
      }
      const price = builderPrice(known.length, site.pricing, site.builder);

      // Los adicionales sólo se cobran si el constructor los ofrece y siguen
      // existiendo; el tamaño y el dulzor no aplican y se dejan neutros.
      const raw = line.options?.extras;
      const asked = Array.isArray(raw) ? raw : [];
      const options = builderOptions(
        base.name,
        site.builder.toppings ? asked.filter((n) => site.toppings.some((t) => t.name === n)) : [],
        String(line.options?.note ?? "").slice(0, 140),
      );

      out.push({
        ...line,
        custom: [base.name, ...known],
        options,
        unitPrice: unitPrice(price, options, site.toppings),
        basePrice: price,
        listPrice: undefined,
        offerLabel: undefined,
        qty: Math.min(qty, MAX_QTY),
      });
      continue;
    }

    // Todo lo que se vende vive en el catálogo: el quiosco sólo elige qué
    // mostrar, no crea productos aparte.
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

    // El precio sale del tamaño pedido, según la categoría o la bebida. Un
    // tamaño sin precio para esta bebida no se cobra con uno inventado.
    const lista = sizePrice(product, options?.size, site);
    if (lista === null) {
      return { error: `«${product.name}» ya no se vende en ese tamaño. Elígelo de nuevo.` };
    }
    const basePrice = offerValid ? offerPriceOf(product, offer.price, options?.size, site) : lista;

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

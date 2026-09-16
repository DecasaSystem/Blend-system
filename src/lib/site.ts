import {
  brand,
  builder,
  builderBases,
  builderIngredients,
  categories,
  dailyIds,
  dailyOffer,
  faqs,
  kiosk,
  KIOSK_FLAT,
  marquee,
  pricing,
  processSteps,
  products,
  rewards,
  sections,
  sizes,
  slides,
  stores,
  toppings,
  type BuilderConfig,
  type BuilderItem,
  type Category,
  type KioskConfig,
  type Pricing,
  type Product,
  type SectionCopy,
  type SectionKey,
  type Size,
  type Slide,
  type Step,
  type Store,
} from "./content";

/**
 * Contenido editable del sitio.
 *
 * `content.ts` son los valores de fábrica. Lo que el equipo publica desde
 * /equipo vive en la base de datos y gana. Se guarda el objeto entero, no
 * parches: así lo que se ve en el editor es exactamente lo que se publica, y
 * "Restaurar" es volver a los valores de fábrica sin ambigüedad.
 */

export type Topping = { name: string; price: number };
export type DailyOffer = { price: number; left: number; why: string };
export type Faq = { q: string; a: string };

export type SiteContent = {
  brand: typeof brand;
  marquee: string[];
  slides: Slide[];
  categories: Category[];
  products: Product[];
  dailyIds: string[];
  dailyOffer: Record<string, DailyOffer>;
  toppings: Topping[];
  sizes: Size[];
  pricing: Pricing;
  builder: BuilderConfig;
  builderBases: BuilderItem[];
  builderIngredients: BuilderItem[];
  stores: Store[];
  sections: Record<SectionKey, SectionCopy>;
  processSteps: Step[];
  rewards: typeof rewards;
  faqs: Faq[];
  kiosk: KioskConfig;
};

/** Copia profunda de los valores de fábrica: nadie debe mutarlos. */
export function defaultSite(): SiteContent {
  return structuredClone({
    brand,
    marquee,
    slides,
    categories,
    products,
    dailyIds,
    dailyOffer,
    toppings,
    sizes,
    pricing,
    builder,
    builderBases,
    builderIngredients,
    stores,
    sections,
    processSteps,
    rewards,
    faqs,
    kiosk,
  });
}

/**
 * Completa lo que falte del contenido guardado con los valores de fábrica.
 *
 * El merge de `loadSiteContent` es superficial: si la fila guardada trae un
 * `kiosk` de antes (sin `productIds`, o sin alguna caja nueva), ese objeto
 * pisa al de fábrica entero y el quiosco revienta con `undefined.map`.
 * Aquí cada caja vieja se rellena campo por campo. Lo mismo con las reglas de
 * «Arma tu blend»: el contenido guardado antes de que existieran no las trae.
 */
export function normalizeSite(site: SiteContent): SiteContent {
  const base = defaultSite();
  const kiosk = site.kiosk ?? base.kiosk;
  const boxes = (kiosk.categories ?? []).map((box) => {
    const fabrica = base.kiosk.categories.find((c) => c.id === box.id);
    // Migra lo que se guardó con el modelo corto de `productIds`: cae en la
    // caja plana para que nada elegido se pierda.
    const legacy = (box as { productIds?: string[] }).productIds;
    const productsByCategory =
      box.productsByCategory ??
      (legacy ? { [KIOSK_FLAT]: legacy } : (fabrica?.productsByCategory ?? {}));
    return {
      id: box.id,
      name: box.name ?? fabrica?.name ?? box.id,
      icon: box.icon ?? fabrica?.icon ?? "🥤",
      color: box.color ?? fabrica?.color ?? "#FF6A1A",
      categoryIds: (box.categoryIds ?? fabrica?.categoryIds ?? []).filter(Boolean),
      productsByCategory,
      useDaily: box.useDaily ?? fabrica?.useDaily ?? false,
    };
  });
  // Cajas nuevas del código que el contenido guardado aún no trae.
  for (const f of base.kiosk.categories) {
    if (!boxes.some((b) => b.id === f.id)) {
      boxes.push({ ...f, useDaily: f.useDaily ?? false });
    }
  }
  // Bases e ingredientes guardados antes de `kcal` vienen sin él: se dejan tal
  // cual, la sección sólo enseña calorías cuando alguno las trae.
  const builderBases = (site.builderBases ?? base.builderBases).filter((b) => b?.name);
  const builderIngredients = (site.builderIngredients ?? base.builderIngredients).filter(
    (i) => i?.name,
  );

  return {
    ...site,
    builderBases,
    builderIngredients,
    builder: builderRules(
      { ...base.builder, ...(site.builder ?? {}) },
      builderIngredients.map((i) => i.name),
    ),
    kiosk: {
      enabled: kiosk.enabled ?? true,
      payOnline: kiosk.payOnline ?? true,
      idleVideo: kiosk.idleVideo,
      idleTitle: kiosk.idleTitle ?? base.kiosk.idleTitle,
      idleSubtitle: kiosk.idleSubtitle ?? base.kiosk.idleSubtitle,
      categories: boxes,
    },
  };
}

/** Tope razonable: más de esto ya no cabe en el vaso ni en la pantalla. */
export const BUILDER_MAX_LIMIT = 12;

/**
 * Deja las reglas del constructor en un estado que no se contradiga.
 *
 * El editor y el servidor pasan por aquí: el máximo es al menos uno, los
 * incluidos en el precio nunca superan al máximo, y los marcados al abrir sólo
 * son ingredientes que existen, sin repetir y sin pasar del máximo. Sin esto,
 * borrar un ingrediente dejaría un nombre fantasma en `preset` y la sección
 * abriría con un hueco.
 */
export function builderRules(rules: BuilderConfig, ingredientNames: string[]): BuilderConfig {
  const max = Math.min(BUILDER_MAX_LIMIT, Math.max(1, Math.floor(Number(rules.max) || 1)));
  const included = Math.min(max, Math.max(0, Math.floor(Number(rules.included) || 0)));
  const preset = Array.from(new Set(Array.isArray(rules.preset) ? rules.preset : []))
    .filter((n) => ingredientNames.includes(n))
    .slice(0, max);
  return { max, included, preset, toppings: rules.toppings !== false };
}

/** Una base o ingrediente nuevo del constructor, listo para editar. */
export function blankBuilderItem(name: string, color: string): BuilderItem {
  return { name, color };
}

/** Un producto nuevo, listo para editar. */
export function blankProduct(categoryId: string): Product {
  return {
    id: `nuevo-${Date.now().toString(36)}`,
    name: "Bebida nueva",
    tagline: "Describe qué lleva y a qué sabe.",
    prices: { chico: 15000 },
    category: categoryId,
    color: "#7B3FF2",
    vessel: "cup",
    ingredients: [{ name: "Ingrediente", color: "#FFB020" }],
  };
}

/** Una categoría nueva del menú. */
export function blankCategory(): Category {
  return {
    id: `cat-${Date.now().toString(36)}`,
    name: "Categoría nueva",
    note: "Describe qué agrupa",
  };
}

export function blankStore(): Store {
  return {
    id: `sede-${Date.now().toString(36)}`,
    name: "Blend Sede Nueva",
    address: "Dirección de la sede",
    area: "Zona",
    hours: "8:00 – 20:00",
    phone: "+57 606 400 0000",
    // Centro de Armenia; el equipo la mueve a su dirección real.
    lat: 4.540962,
    lng: -75.659869,
    services: [],
  };
}

/** Cuánto ocupa el contenido, en KB. Las fotos son lo que pesa. */
export function sizeKb(site: SiteContent) {
  return Math.round(JSON.stringify(site).length / 1024);
}

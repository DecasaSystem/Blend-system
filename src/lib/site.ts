import {
  brand,
  builderBases,
  builderIngredients,
  categories,
  dailyIds,
  dailyOffer,
  faqs,
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
  type Category,
  type Ingredient,
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
  builderBases: Ingredient[];
  builderIngredients: Ingredient[];
  stores: Store[];
  sections: Record<SectionKey, SectionCopy>;
  processSteps: Step[];
  rewards: typeof rewards;
  faqs: Faq[];
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
    builderBases,
    builderIngredients,
    stores,
    sections,
    processSteps,
    rewards,
    faqs,
  });
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

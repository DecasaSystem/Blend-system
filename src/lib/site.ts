import {
  brand,
  builderBases,
  builderIngredients,
  categories,
  dailyIds,
  dailyOffer,
  faqs,
  marquee,
  processSteps,
  products,
  rewards,
  sections,
  slides,
  stores,
  toppings,
  type Category,
  type Ingredient,
  type Product,
  type SectionCopy,
  type SectionKey,
  type Slide,
  type Step,
  type Store,
} from "./content";

/**
 * Contenido editable del sitio.
 *
 * `content.ts` son los valores de fábrica. Lo que el equipo guarda desde /equipo
 * vive aparte y gana. Se guarda el objeto completo, no parches: así lo que se ve
 * en el editor es exactamente lo que se publica, y "Restaurar" es volver a los
 * valores de fábrica sin ambigüedad.
 *
 * En la fase 7 esto pasa a base de datos; la forma del objeto no cambia.
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
  builderBases: Ingredient[];
  builderIngredients: Ingredient[];
  stores: Store[];
  sections: Record<SectionKey, SectionCopy>;
  processSteps: Step[];
  rewards: typeof rewards;
  faqs: Faq[];
};

const KEY = "blend.site.v1";
const EVENT = "blend:site";

/** Copia profunda de los valores de fábrica: el editor nunca debe mutarlos. */
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
    builderBases,
    builderIngredients,
    stores,
    sections,
    processSteps,
    rewards,
    faqs,
  });
}

export function readSite(): SiteContent {
  const base = defaultSite();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<SiteContent>;
    // Mezcla superficial: si el código añade una sección nueva, aparece aunque
    // el equipo tenga contenido guardado de antes.
    return { ...base, ...saved };
  } catch {
    return base;
  }
}

export function writeSite(next: SiteContent) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    // Sobre todo: cuota llena por imágenes pesadas.
    throw new Error(
      err instanceof Error && err.name === "QuotaExceededError"
        ? "No cabe. Borra alguna imagen antes de guardar otra."
        : "No se pudo guardar el contenido.",
    );
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function resetSite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function hasSavedSite() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/** Cuánto ocupa el contenido guardado, en KB. Las fotos son lo que pesa. */
export function savedSizeKb() {
  try {
    return Math.round(((localStorage.getItem(KEY)?.length ?? 0) * 2) / 1024);
  } catch {
    return 0;
  }
}

export function subscribeSite(fn: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Un producto nuevo, listo para editar. */
export function blankProduct(categoryId: string): Product {
  return {
    id: `nuevo-${Date.now().toString(36)}`,
    name: "Bebida nueva",
    tagline: "Describe qué lleva y a qué sabe.",
    price: 15000,
    category: categoryId,
    kcal: 180,
    color: "#7B3FF2",
    vessel: "cup",
    ingredients: [{ name: "Ingrediente", color: "#FFB020" }],
  };
}

export function blankStore(): Store {
  return {
    id: `sede-${Date.now().toString(36)}`,
    name: "Blend Sede Nueva",
    address: "Dirección de la sede",
    area: "Zona",
    hours: "8:00 – 20:00",
    phone: "+57 601 400 0000",
    x: 50,
    y: 40,
    services: [],
  };
}

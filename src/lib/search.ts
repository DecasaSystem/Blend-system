import type { Category, Product } from "./content";

/**
 * Buscador del menú.
 *
 * Corre en el navegador, sobre el menú que ya está cargado: sin ir al
 * servidor en cada tecla. Con unas decenas de bebidas, puntuarlas todas en
 * cada pulsación tarda menos de un milisegundo.
 *
 * Se busca como habla la gente, no como está escrito el menú:
 * - Sin tildes ni mayúsculas: «limon» encuentra «Limón».
 * - Con errores de dedo: «maracuya», «maracuyá» y «marakuya» son lo mismo.
 * - Con palabras clave que no salen en la carta: «tropical» trae mango,
 *   piña y coco; «sin azúcar», lo marcado así; «café», el cold brew.
 * - Por el principio de la palabra mientras se escribe: «gra» ya trae
 *   granizados y granola.
 *
 * Todas las palabras tienen que encajar en algo de la bebida. Si ninguna
 * bebida las cumple todas, se enseñan las que cumplen alguna, como
 * «parecidos», en vez de una pantalla vacía.
 */

/** Minúsculas, sin tildes y sin signos: la forma en que se compara todo. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras que no ayudan a buscar: «algo de mango para llevar» busca «mango». */
const STOP = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "con", "en",
  "para", "por", "que", "algo", "quiero", "me", "mi", "al", "lo", "su", "tu", "muy", "mas",
]);

/**
 * Palabras clave → lo que significan en este menú. Cada una se busca como si
 * se hubiera escrito cualquiera de sus equivalentes. Van ya normalizadas.
 */
const KEYWORDS: Record<string, string[]> = {
  tropical: ["mango", "pina", "coco", "maracuya", "papaya", "guanabana", "maracumango"],
  citrico: ["naranja", "limon", "mandarina", "limonada"],
  rojos: ["fresa", "mora", "cereza", "arandanos", "blueberry", "frutos rojos", "uva"],
  frutos: ["fresa", "mora", "cereza", "arandanos", "blueberry"],
  "frutos rojos": ["fresa", "mora", "cereza", "arandanos", "blueberry", "uva"],
  "sin azucar": ["sin azucar"],
  verde: ["matcha", "espinaca", "verde", "detox", "apio", "pepino", "green"],
  detox: ["detox", "verde", "apio", "pepino", "perejil", "funcional"],
  saludable: ["sin azucar", "detox", "verde", "funcional", "fibra", "natural"],
  light: ["sin azucar", "agua", "natural", "detox"],
  fit: ["proteina", "sin azucar", "granola", "detox", "funcional"],
  dieta: ["sin azucar", "detox", "natural"],
  azucar: ["sin azucar"],
  natural: ["natural", "100", "pura"],
  proteina: ["proteina", "yogurt", "banano", "granola", "mani", "almendra"],
  gym: ["proteina", "banano", "yogurt", "granola"],
  energia: ["red bull", "redbull", "matcha", "cold brew", "espresso", "cafe"],
  cafe: ["cold brew", "espresso", "cafe"],
  cafeina: ["cold brew", "espresso", "matcha", "red bull", "cafe"],
  leche: ["leche", "latte", "yogurt", "helado", "milo"],
  cremoso: ["yogurt", "helado", "leche", "latte", "crema"],
  dulce: ["chocolate", "helado", "dulce", "milo", "cacao", "miel"],
  chocolate: ["chocolate", "cacao", "milo"],
  frio: ["granizado", "frio", "frios", "refrescante", "hielo"],
  refrescante: ["refrescante", "granizado", "limonada", "agua", "yerbabuena"],
  calor: ["granizado", "refrescante", "limonada", "frio"],
  gripa: ["gripa", "jengibre", "miel", "naranja"],
  defensas: ["naranja", "jengibre", "mandarina", "curcuma"],
  crispetas: ["pop corn", "crispeta", "crispetas", "caja", "bolsa", "cono"],
  palomitas: ["pop corn", "crispeta", "crispetas"],
  cine: ["pop corn", "crispeta", "cine", "combo"],
  compartir: ["combo", "familiar"],
  familia: ["combo", "familiar"],
  combo: ["combo"],
  batido: ["batido", "smoothie", "yogurt", "helado"],
  smoothie: ["smoothie", "batido", "yogurt", "helado"],
  jugo: ["jugo", "natural", "naranja", "mandarina"],
  te: ["te", "matcha"],
  nuevo: ["nuevo"],
  popular: ["mas pedido"],
  recomendado: ["mas pedido", "nuevo"],
  barato: [],
  economico: [],
};

/** Ingredientes de relleno que trae una bebida recién creada: no dicen nada. */
const PLACEHOLDER = new Set(["ingrediente", ""]);

type Field = { words: string[]; text: string; weight: number };

export type SearchDoc = { product: Product; fields: Field[]; price: number };

/** Prepara el menú para buscar. Se hace una vez cada vez que cambia el menú. */
export function buildIndex(
  products: Product[],
  categories: Category[],
  priceOf: (p: Product) => number,
): SearchDoc[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const field = (text: string, weight: number): Field => {
    const t = normalize(text);
    return { text: t, words: t.split(" ").filter(Boolean), weight };
  };
  return products.map((p) => ({
    product: p,
    price: priceOf(p),
    fields: [
      field(p.name, 6),
      field(catName.get(p.category) ?? "", 3),
      field(p.badge ?? "", 3),
      field(p.tagline, 2),
      field(
        p.ingredients
          .map((i) => i.name)
          .filter((n) => !PLACEHOLDER.has(normalize(n)))
          .join(" "),
        2,
      ),
    ],
  }));
}

/** Distancia de edición con tope: sólo interesa saber si es 0, 1 o 2. */
function within(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/**
 * Cuánto encaja un término (una palabra o una frase corta) en un campo. 0 = nada.
 *
 * `strict` es para los equivalentes de una palabra clave: ésos se escribieron
 * aquí, no los tecleó nadie, así que no se les perdonan errores. Si no,
 * «crispetas» traía «cono», y «cono» a medio menú por parecerse a «coco».
 */
function termScore(term: string, f: Field, last: boolean, strict = false): number {
  if (!f.text) return 0;
  if (term.includes(" ")) return f.text.includes(term) ? 1 : 0;
  let best = 0;
  for (const w of f.words) {
    if (w === term) return 1;
    if (strict) {
      if (term.length >= 4 && w.startsWith(term)) best = Math.max(best, 0.85);
      continue;
    }
    // Mientras se escribe, la última palabra va a medias: «gra» → «granizado».
    if (w.startsWith(term) && (last || term.length >= 4)) best = Math.max(best, 0.85);
    else if (term.length >= 4 && w.includes(term)) best = Math.max(best, 0.6);
    else if (term.length >= 4 && within(term, w, term.length >= 7 ? 2 : 1)) {
      best = Math.max(best, 0.7);
    }
  }
  return best;
}

/** Los términos que valen por una palabra: ella misma y, si es clave, sus equivalentes. */
function expand(word: string, typing = false): { terms: string[]; keyword: boolean } {
  // «arandano» y «arandanos», «frutal» y «fruta»: la clave sin la s final también vale.
  const key = KEYWORDS[word] ? word : KEYWORDS[word.replace(/s$/, "")] ? word.replace(/s$/, "") : "";
  if (key) return { terms: [word, ...KEYWORDS[key]], keyword: true };
  // A medio escribir: «trop» ya vale por «tropical», sin esperar la última letra.
  if (typing && word.length >= 3) {
    const extra = Object.keys(KEYWORDS)
      .filter((k) => k.startsWith(word) && KEYWORDS[k].length > 0)
      .flatMap((k) => KEYWORDS[k]);
    if (extra.length > 0) return { terms: [word, ...extra], keyword: false };
  }
  return { terms: [word], keyword: false };
}

export type SearchResult = {
  products: Product[];
  /** true si nada cumplía todas las palabras y se enseñan las que cumplen alguna. */
  partial: boolean;
};

export function searchMenu(index: SearchDoc[], query: string): SearchResult {
  const q = normalize(query);
  // «sin azúcar» es una idea, no dos palabras: se busca junta.
  const phrases = ["sin azucar", "frutos rojos", "cold brew", "mas pedido", "red bull", "pop corn"];
  const found = phrases.filter((p) => q.includes(p));
  let rest = q;
  for (const p of found) rest = rest.replace(p, " ");
  const words = rest.split(" ").filter((w) => w && !STOP.has(w));
  const typing = !query.endsWith(" ");
  const parts = [...found, ...words].map((w, i, all) => expand(w, typing && i === all.length - 1));
  if (parts.length === 0) return { products: [], partial: false };

  // «barato»: no filtra, ordena por precio.
  const cheap = words.some((w) => w === "barato" || w === "economico");

  const scored = index.map((doc) => {
    let total = 0;
    let hits = 0;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1 && !query.endsWith(" ");
      let best = 0;
      for (const f of doc.fields) {
        for (const [k, term] of part.terms.entries()) {
          // Lo que se escribió pesa más que lo que se dedujo de la palabra clave.
          const s = termScore(term, f, last, k > 0) * f.weight * (k === 0 ? 1 : 0.8);
          if (s > best) best = s;
        }
      }
      // Una palabra clave sin equivalentes («barato») no exige nada.
      if (best > 0 || (part.keyword && part.terms.length === 1)) hits++;
      total += best;
    });
    return { doc, total, hits };
  });

  const order = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    Number(a.doc.product.soldOut ?? false) - Number(b.doc.product.soldOut ?? false) ||
    (cheap ? a.doc.price - b.doc.price : 0) ||
    b.total - a.total ||
    a.doc.price - b.doc.price;

  const all = scored.filter((s) => s.hits === parts.length && (s.total > 0 || cheap));
  if (all.length > 0) return { products: all.sort(order).map((s) => s.doc.product), partial: false };

  const some = scored.filter((s) => s.total > 0).sort((a, b) => b.hits - a.hits || order(a, b));
  return { products: some.map((s) => s.doc.product), partial: some.length > 0 };
}

/**
 * Para empezar a buscar sin saber qué escribir: las ideas que sí dan
 * resultados en este menú. Una sugerencia que no encuentra nada no sale.
 */
export function suggestions(index: SearchDoc[]): string[] {
  const ideas = ["Tropical", "Sin azúcar", "Frutos rojos", "Café", "Cremoso", "Detox", "Cítrico", "Para compartir"];
  return ideas.filter((idea) => searchMenu(index, idea).products.length > 0 && !searchMenu(index, idea).partial);
}

/** Palabras del menú que completan lo que se lleva escrito: «gra» → «granizados», «granola». */
export function completions(index: SearchDoc[], query: string, limit = 4): string[] {
  const q = normalize(query);
  const last = q.split(" ").pop() ?? "";
  if (last.length < 2) return [];
  const seen = new Map<string, { label: string; weight: number }>();
  for (const doc of index) {
    for (const f of doc.fields) {
      if (f.weight < 3) continue;
      for (const w of f.words) {
        if (w.length > last.length && w.startsWith(last) && !seen.has(w)) {
          seen.set(w, { label: w, weight: f.weight });
        }
      }
    }
  }
  for (const k of Object.keys(KEYWORDS)) {
    if (k.length > last.length && k.startsWith(last) && !seen.has(k)) seen.set(k, { label: k, weight: 2 });
  }
  const head = q.slice(0, q.length - last.length);
  return [...seen.values()]
    .sort((a, b) => b.weight - a.weight || a.label.length - b.label.length)
    .slice(0, limit)
    .map((s) => `${head}${s.label}`);
}

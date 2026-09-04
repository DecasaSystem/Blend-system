/**
 * Fuente de verdad del contenido de la tienda.
 * Todo lo que hay aquí será editable desde /equipo en la fase 4.
 * Los campos `media` están vacíos a propósito: cuando el equipo suba un video o
 * una foto, la UI la usa; mientras tanto dibuja la ilustración generada.
 *
 * Precios en pesos colombianos, sin decimales.
 */

export type Ingredient = { name: string; color: string };

export type Vessel = "cup" | "chawan" | "bowl" | "glass" | "bottle";

export type Category = {
  id: string;
  name: string;
  note: string;
};

export type Product = {
  id: string;
  name: string;
  tagline: string;
  /**
   * Precio por tamaño: `{ chico: 17900, grande: 22400 }`.
   *
   * Una bebida no tiene un precio, tiene uno por vaso. Antes había un precio
   * único más un recargo global por tamaño, y eso obligaba a que la diferencia
   * entre chico y grande fuera la misma en un batido que en un bowl.
   *
   * Si falta el tamaño que se pide, se cae al recargo global (ver
   * `priceOf` en `src/lib/cart.ts`): así añadir un tamaño nuevo no deja el
   * menú entero sin precio hasta que se rellene bebida por bebida.
   */
  prices: Record<string, number>;
  /** Lo que costaba antes de tener precio por vaso. Sólo es red de seguridad. */
  price?: number;
  category: string;
  color: string;
  vessel: Vessel;
  ingredients: Ingredient[];
  badge?: string;
  media?: string;
  soldOut?: boolean;
};

export type Slide = {
  id: string;
  kicker: string;
  title: string;
  accent: string;
  body: string;
  cta: { label: string; href: string };
  tone: string;
  vessel: Vessel;
  /** Video o foto de fondo del carrusel. Editable desde /equipo. */
  media?: string;
  /**
   * Foto grande que va encima del carrusel, al lado del texto. Si está vacía se
   * dibuja el recipiente ilustrado (`vessel`). Editable desde /equipo.
   */
  art?: string;
  /**
   * Cuánto se ve el fondo, de 0 a 100. Por debajo de 100 la tinta oscura lo
   * apaga para que el texto siga legible. Editable desde /equipo.
   */
  mediaOpacity?: number;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  area: string;
  hours: string;
  phone: string;
  /** Coordenadas reales. El mapa ilustrado las proyecta; el mapa real las usa tal cual. */
  lat: number;
  lng: number;
  services: string[];
};

export const brand = {
  name: "BLEND",
  tagline: "Casa de batidos, matcha y açaí",
  city: "Armenia",
  /** Si está vacío, se dibuja la marca de tres tintas. Editable desde /equipo. */
  logo: "https://res.cloudinary.com/dmcjbwyhv/image/upload/v1787925497/WhatsApp_Image_2026-08-27_at_10.05.27_qcqywf.jpg",
  delivery: "Entrega en 25 min",
  phone: "+57 606 400 1180",
  email: "hola@blend.cafe",
  instagram: "@blend.cafe",
};

export const marquee = [
  "Batido del día · Mango Terco a $14.900",
  "Entrega en 25 minutos",
  "Matcha ceremonial de Uji, molido esta semana",
  "Tu sexto batido va por la casa",
  "Abierto 7:00 – 21:00",
];

export const slides: Slide[] = [
  {
    id: "s1",
    kicker: "Todo se mezcla",
    title: "Fruta que",
    accent: "grita",
    body: "Mango, maracuyá y jengibre en frío. Sin azúcar añadida, sin concentrados, sin adornos.",
    cta: { label: "Ver el menú", href: "#menu" },
    tone: "#FF6A1A",
    vessel: "cup",
  },
  {
    id: "s2",
    kicker: "Matcha de Uji",
    title: "Verde de",
    accent: "primera cosecha",
    body: "Lo molemos cada semana. Si sabe amargo, no es matcha bueno: es matcha viejo.",
    cta: { label: "Conocer el matcha", href: "#menu" },
    tone: "#8FD14F",
    vessel: "chawan",
  },
  {
    id: "s3",
    kicker: "Arma tu blend",
    title: "Tú eliges",
    accent: "los tres",
    body: "Tres ingredientes, una base, los toppings que quieras. El color te lo decimos antes de servir.",
    cta: { label: "Empezar a mezclar", href: "#constructor" },
    tone: "#7B3FF2",
    vessel: "bowl",
  },
];

export const categories: Category[] = [
  { id: "batidos", name: "Batidos", note: "Fruta congelada, nunca hielo" },
  { id: "matcha", name: "Matcha", note: "Uji, primera cosecha" },
  { id: "bowls", name: "Açaí bowls", note: "Con granola de la casa" },
  { id: "coldbrew", name: "Cold brew", note: "18 horas de reposo" },
  { id: "extras", name: "Extras", note: "Shots, granolas y compañía" },
];

export const products: Product[] = [
  {
    id: "mango-terco",
    name: "Mango Terco",
    tagline: "Mango de Tolima, maracuyá y un golpe de jengibre.",
    prices: { chico: 17900, grande: 22400 },
    category: "batidos",
    color: "#FF8A2B",
    vessel: "cup",
    badge: "Más pedido",
    ingredients: [
      { name: "Mango", color: "#FFB020" },
      { name: "Maracuyá", color: "#FF6A1A" },
      { name: "Jengibre", color: "#E8C468" },
    ],
  },
  {
    id: "verde-que-te-quiero",
    name: "Verde Que Te Quiero",
    tagline: "Espinaca, piña, menta y limón. Sabe a piña, no a espinaca.",
    prices: { chico: 18500, grande: 23000 },
    category: "batidos",
    color: "#8FD14F",
    vessel: "cup",
    ingredients: [
      { name: "Espinaca", color: "#4E9B34" },
      { name: "Piña", color: "#FFD166" },
      { name: "Menta", color: "#8FD14F" },
    ],
  },
  {
    id: "ube-nocturno",
    name: "Ube Nocturno",
    tagline: "Ube, leche de coco y dátil. Morado de verdad, no de colorante.",
    prices: { chico: 21900, grande: 26400 },
    category: "batidos",
    color: "#7B3FF2",
    vessel: "cup",
    badge: "Nuevo",
    ingredients: [
      { name: "Ube", color: "#7B3FF2" },
      { name: "Coco", color: "#F3E9DC" },
      { name: "Dátil", color: "#8A5A2B" },
    ],
  },
  {
    id: "fresa-descalza",
    name: "Fresa Descalza",
    tagline: "Fresa, banano y avena. El que piden los niños y repiten los papás.",
    prices: { chico: 16900, grande: 21400 },
    category: "batidos",
    color: "#F2557A",
    vessel: "cup",
    ingredients: [
      { name: "Fresa", color: "#F2557A" },
      { name: "Banano", color: "#FFD166" },
      { name: "Avena", color: "#E3D3B8" },
    ],
  },
  {
    id: "sandia-electrica",
    name: "Sandía Eléctrica",
    tagline: "Sandía, limón y sal rosada. Para después de trotar.",
    prices: { chico: 15900, grande: 20400 },
    category: "batidos",
    color: "#FF4D6D",
    vessel: "glass",
    ingredients: [
      { name: "Sandía", color: "#FF4D6D" },
      { name: "Limón", color: "#A9CF3F" },
      { name: "Sal rosada", color: "#F7C9CE" },
    ],
  },
  {
    id: "matcha-ceremonial",
    name: "Matcha Ceremonial",
    tagline: "Solo matcha y agua a 80°. Batido a mano en chasen.",
    prices: { chico: 19500, grande: 24000 },
    category: "matcha",
    color: "#6FA82E",
    vessel: "chawan",
    badge: "Sin azúcar",
    ingredients: [
      { name: "Matcha Uji", color: "#6FA82E" },
      { name: "Agua 80°", color: "#DFF0C8" },
    ],
  },
  {
    id: "matcha-yuzu",
    name: "Matcha Yuzu",
    tagline: "Matcha, yuzu y tónica. Burbujea y despierta.",
    prices: { chico: 22900, grande: 27400 },
    category: "matcha",
    color: "#A9CF3F",
    vessel: "glass",
    badge: "De temporada",
    ingredients: [
      { name: "Matcha", color: "#6FA82E" },
      { name: "Yuzu", color: "#FFD166" },
      { name: "Tónica", color: "#E8F4D9" },
    ],
  },
  {
    id: "matcha-ube-latte",
    name: "Matcha Ube Latte",
    tagline: "Dos capas que no se mezclan hasta que tú lo decides.",
    prices: { chico: 23900, grande: 28400 },
    category: "matcha",
    color: "#8B6FE0",
    vessel: "glass",
    ingredients: [
      { name: "Matcha", color: "#6FA82E" },
      { name: "Ube", color: "#7B3FF2" },
      { name: "Leche de avena", color: "#F0E6D6" },
    ],
  },
  {
    id: "hojicha-miel",
    name: "Hojicha Miel",
    tagline: "Té tostado con miel de azahar. Tibio, para las tardes largas.",
    prices: { chico: 18900, grande: 23400 },
    category: "matcha",
    color: "#B4762E",
    vessel: "chawan",
    ingredients: [
      { name: "Hojicha", color: "#B4762E" },
      { name: "Miel", color: "#FFC24A" },
    ],
  },
  {
    id: "acai-clasico",
    name: "Açaí Clásico",
    tagline: "Açaí puro, banano, granola de la casa y fresa.",
    prices: { chico: 28900, grande: 33400 },
    category: "bowls",
    color: "#6B2FA8",
    vessel: "bowl",
    badge: "Más pedido",
    ingredients: [
      { name: "Açaí", color: "#6B2FA8" },
      { name: "Banano", color: "#FFD166" },
      { name: "Granola", color: "#C89A5B" },
    ],
  },
  {
    id: "acai-mango-chile",
    name: "Açaí Mango Chile",
    tagline: "Açaí con mango, ají y limón. Dulce y luego pica.",
    prices: { chico: 30900, grande: 35400 },
    category: "bowls",
    color: "#C74A2B",
    vessel: "bowl",
    ingredients: [
      { name: "Açaí", color: "#6B2FA8" },
      { name: "Mango", color: "#FFB020" },
      { name: "Ají", color: "#C74A2B" },
    ],
  },
  {
    id: "pitaya-rosa",
    name: "Pitaya Rosa",
    tagline: "Pitaya, coco y semilla de chía. El bowl más ligero.",
    prices: { chico: 27900, grande: 32400 },
    category: "bowls",
    color: "#E0457B",
    vessel: "bowl",
    ingredients: [
      { name: "Pitaya", color: "#E0457B" },
      { name: "Coco", color: "#F3E9DC" },
      { name: "Chía", color: "#3A3040" },
    ],
  },
  {
    id: "cold-brew-naranja",
    name: "Cold Brew Naranja",
    tagline: "Cold brew de 18 horas con jugo de naranja y hielo.",
    prices: { chico: 15900, grande: 20400 },
    category: "coldbrew",
    color: "#C05A16",
    vessel: "glass",
    ingredients: [
      { name: "Cold brew", color: "#4A2C1A" },
      { name: "Naranja", color: "#FF8A2B" },
    ],
  },
  {
    id: "tonica-de-cafe",
    name: "Tónica de Café",
    tagline: "Espresso frío sobre tónica y cáscara de limón.",
    prices: { chico: 16900, grande: 21400 },
    category: "coldbrew",
    color: "#4A2C1A",
    vessel: "glass",
    ingredients: [
      { name: "Espresso", color: "#4A2C1A" },
      { name: "Tónica", color: "#E4EDDD" },
      { name: "Limón", color: "#A9CF3F" },
    ],
  },
  {
    id: "shot-jengibre",
    name: "Shot de Jengibre",
    tagline: "Jengibre, cúrcuma, limón y pimienta. 60 ml que duelen bonito.",
    prices: { chico: 8900, grande: 13400 },
    category: "extras",
    color: "#FFB020",
    vessel: "bottle",
    ingredients: [
      { name: "Jengibre", color: "#E8C468" },
      { name: "Cúrcuma", color: "#FFB020" },
      { name: "Limón", color: "#A9CF3F" },
    ],
  },
  {
    id: "granola-casa",
    name: "Granola de la Casa",
    tagline: "Avena, nuez, coco y miel. Bolsa de 300 g para llevar.",
    prices: { chico: 29900, grande: 34400 },
    category: "extras",
    color: "#C89A5B",
    vessel: "bottle",
    ingredients: [
      { name: "Avena", color: "#E3D3B8" },
      { name: "Nuez", color: "#8A5A2B" },
      { name: "Coco", color: "#F3E9DC" },
    ],
  },
];

/** Los tres del día. El equipo los rota desde /equipo. */
export const dailyIds = ["mango-terco", "matcha-yuzu", "acai-mango-chile"];

export const dailyOffer: Record<string, { price: number; left: number; why: string }> = {
  "mango-terco": { price: 14900, left: 14, why: "Llegó mango de Tolima esta mañana" },
  "matcha-yuzu": { price: 18900, left: 8, why: "Último lote de yuzu de la temporada" },
  "acai-mango-chile": { price: 24900, left: 21, why: "Probando receta nueva, danos tu opinión" },
};

export const builderBases: Ingredient[] = [
  { name: "Leche de avena", color: "#F0E6D6" },
  { name: "Agua de coco", color: "#E4F2EA" },
  { name: "Leche de almendra", color: "#EFE2CE" },
  { name: "Jugo de naranja", color: "#FF8A2B" },
];

export const builderIngredients: Ingredient[] = [
  { name: "Mango", color: "#FFB020" },
  { name: "Fresa", color: "#F2557A" },
  { name: "Açaí", color: "#6B2FA8" },
  { name: "Matcha", color: "#6FA82E" },
  { name: "Espinaca", color: "#4E9B34" },
  { name: "Piña", color: "#FFD166" },
  { name: "Ube", color: "#7B3FF2" },
  { name: "Banano", color: "#F5DE8A" },
  { name: "Pitaya", color: "#E0457B" },
  { name: "Cacao", color: "#5B3A2A" },
  { name: "Maracuyá", color: "#FF6A1A" },
  { name: "Menta", color: "#8FD14F" },
];

export const toppings = [
  { name: "Granola de la casa", price: 4500 },
  { name: "Mantequilla de maní", price: 5500 },
  { name: "Cacao nibs", price: 4000 },
  { name: "Chía", price: 3000 },
  { name: "Coco tostado", price: 3500 },
  { name: "Proteína de guisante", price: 7500 },
];

/** Un tamaño de la hoja de personalización. `delta` es lo que suma al precio. */
export type Size = { id: string; label: string; volume: string; delta: number };

export const sizes: Size[] = [
  { id: "chico", label: "Chico", volume: "350 ml", delta: 0 },
  { id: "grande", label: "Grande", volume: "500 ml", delta: 4500 },
];

/**
 * Los precios que no viven en una bebida concreta: domicilio, tamaños y el
 * constructor. Estaban repartidos por el código como constantes; ahora los
 * edita el equipo desde /equipo y el servidor cobra con estos mismos números.
 */
export type Pricing = {
  /** Cuánto cuesta el domicilio y a partir de cuánto va gratis. */
  delivery: { fee: number; freeFrom: number };
  /** «Arma tu blend»: precio con dos ingredientes y recargo del tercero. */
  builder: { base: number; perExtra: number };
};

export const pricing: Pricing = {
  delivery: { fee: 6900, freeFrom: 60000 },
  builder: { base: 18900, perExtra: 3000 },
};

export const stores: Store[] = [
  {
    id: "norte",
    name: "Blend Norte",
    address: "Cra. 14 #25 Norte-2, Armenia, Quindío",
    area: "Norte",
    hours: "7:00 – 21:00",
    phone: "+57 606 400 1180",
    lat: 4.561402,
    lng: -75.652527,
    services: ["Barra de matcha", "Pedido para llevar", "Pet friendly"],
  },
  {
    id: "centro",
    name: "Blend Centro",
    address: "Cra. 6 #3-423, Armenia, Quindío",
    area: "Centro",
    hours: "8:00 – 20:00",
    phone: "+57 606 400 1181",
    lat: 4.540962,
    lng: -75.659869,
    services: ["Terraza", "Bowls hasta las 18:00", "Wi-Fi"],
  },
];

/** Encabezado de cada sección. Editable desde /equipo. */
export type SectionCopy = {
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  /** Imagen opcional bajo el encabezado. */
  image?: string;
};

export type SectionKey = "daily" | "menu" | "builder" | "stores" | "contact";

export const sections: Record<SectionKey, SectionCopy> = {
  daily: {
    eyebrow: "Hoy",
    title: "Lo que sale",
    accent: "hoy",
    body: "Tres recetas con precio del día. Cambian cuando llega la fruta, no cuando lo dice el calendario.",
  },
  menu: {
    eyebrow: "Menú completo",
    title: "Todo lo que",
    accent: "licuamos",
    body: "Toca una para elegir tamaño, base y toppings.",
  },
  builder: {
    eyebrow: "Arma tu blend",
    title: "Elige tres. Te decimos",
    accent: "de qué color sale",
    body: "Los mismos ingredientes que usamos en barra. El color de arriba es el que vas a recibir.",
  },
  stores: {
    eyebrow: "Dos tiendas en Armenia",
    title: "Dónde nos",
    accent: "encuentras",
    body: "Toca un pin para ver horarios y cómo llegar. Las dos hacen pedido para llevar.",
  },
  contact: {
    eyebrow: "Contacto",
    title: "Escríbenos y",
    accent: "contestamos",
    body: "Barra abierta de 7:00 a 21:00. Los mensajes fuera de horario se responden a la mañana siguiente.",
  },
};

export type Step = { title: string; body: string; color: string };

export type KioskCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  /**
   * Sub-categorías del menú que la caja muestra (pestañas Todo, Batidos,
   * Matcha… en el quiosco). Caja sin esto es una lista plana.
   */
  categoryIds: string[];
  /**
   * Qué productos del menú salen en cada sub-categoría: la clave es el id de
   * la categoría (`batidos`, `matcha`…) y el valor los ids elegidos. Las cajas
   * planas usan la clave `_default`. Sub-categoría sin selección muestra todo
   * lo de esa categoría. Nada se crea dos veces: todo apunta a «Menú» con su
   * precio, su foto y sus ingredientes.
   */
  productsByCategory: Record<string, string[]>;
  useDaily?: boolean;
};

/** Clave interna de `productsByCategory` para las cajas sin sub-categorías. */
export const KIOSK_FLAT = "_default";

export type KioskConfig = {
  enabled: boolean;
  idleVideo?: string;
  idleTitle: string;
  idleSubtitle: string;
  categories: KioskCategory[];
};

export const kiosk: KioskConfig = {
  enabled: true,
  idleTitle: "Pide aquí",
  idleSubtitle: "Toca para empezar",
  categories: [
    {
      id: "batidos",
      name: "Batidos",
      icon: "🥤",
      color: "#FF6A1A",
      categoryIds: ["batidos", "matcha", "bowls", "coldbrew", "extras"],
      // Vacío = cada sub-categoría muestra todo lo suyo. El editor llena por
      // sub-categoría lo que el equipo elija.
      productsByCategory: {},
    },
    {
      id: "crispetas",
      name: "Crispetas",
      icon: "🍿",
      color: "#FFD166",
      categoryIds: [],
      // Caja plana: el editor elige los productos del menú que van aquí.
      productsByCategory: { [KIOSK_FLAT]: [] },
    },
    {
      id: "dia",
      name: "Batidos del día",
      icon: "✨",
      color: "#8FD14F",
      categoryIds: [],
      productsByCategory: { [KIOSK_FLAT]: [] },
      useDaily: true,
    },
    {
      id: "combos",
      name: "Combos",
      icon: "🎁",
      color: "#7B3FF2",
      categoryIds: ["batidos", "matcha", "bowls", "coldbrew", "extras"],
      productsByCategory: {},
    },
  ],
};

export const processSteps: Step[] = [
  {
    title: "Pides",
    body: "Eliges del menú o armas el tuyo. La barra ve tu pedido en el momento en que pagas.",
    color: "#FF6A1A",
  },
  {
    title: "Licuamos",
    body: "Fruta congelada esa mañana, sin hielo. Nada se prepara antes de que llegue tu nombre.",
    color: "#7B3FF2",
  },
  {
    title: "Llega",
    body: "Veinticinco minutos a tu puerta o listo para recoger. Si nos pasamos, el domicilio va por nuestra cuenta.",
    color: "#8FD14F",
  },
];

export const rewards = {
  eyebrow: "Sellos digitales",
  title: "El sexto batido",
  accent: "va por la casa",
  body: "Se acumula solo con tu teléfono al pagar. Sin app, sin tarjeta, sin registro.",
  stamps: 6,
  filled: 3,
};

export const faqs = [
  {
    q: "¿Cuánto tarda una entrega?",
    a: "Veinticinco minutos dentro del radio de cada tienda. Si nos pasamos de treinta, el domicilio va por nuestra cuenta.",
  },
  {
    q: "¿Los batidos llevan azúcar?",
    a: "No añadimos azúcar a ninguno. La dulzura viene de la fruta y del dátil. Si lo quieres más dulce, pídelo con miel al hacer el pedido.",
  },
  {
    q: "¿Puedo pedir sin lácteos?",
    a: "Todas las bases son vegetales. La leche de vaca solo entra si la pides.",
  },
  {
    q: "¿Tienen programa de recompensas?",
    a: "Sí. Cada compra suma un sello y el sexto batido va por la casa. Se acumula solo con tu número de teléfono.",
  },
];

export function productById(id: string) {
  return products.find((p) => p.id === id);
}

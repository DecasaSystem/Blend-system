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
  price: number;
  category: string;
  kcal: number;
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
  /** Video del carrusel. Editable desde /equipo. */
  media?: string;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  area: string;
  hours: string;
  phone: string;
  /** Coordenadas relativas al mapa (0–100). Se cambian por lat/lng reales en la fase 5. */
  x: number;
  y: number;
  services: string[];
};

export const brand = {
  name: "BLEND",
  tagline: "Casa de batidos, matcha y açaí",
  city: "Bogotá",
  /** Si está vacío, se dibuja la marca de tres tintas. Editable desde /equipo. */
  logo: "https://res.cloudinary.com/dmcjbwyhv/image/upload/v1787925497/WhatsApp_Image_2026-08-27_at_10.05.27_qcqywf.jpg",
  delivery: "Entrega en 25 min",
  phone: "+57 601 400 1180",
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
    price: 17900,
    category: "batidos",
    kcal: 210,
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
    price: 18500,
    category: "batidos",
    kcal: 175,
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
    price: 21900,
    category: "batidos",
    kcal: 265,
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
    price: 16900,
    category: "batidos",
    kcal: 240,
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
    price: 15900,
    category: "batidos",
    kcal: 130,
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
    price: 19500,
    category: "matcha",
    kcal: 12,
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
    price: 22900,
    category: "matcha",
    kcal: 95,
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
    price: 23900,
    category: "matcha",
    kcal: 220,
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
    price: 18900,
    category: "matcha",
    kcal: 150,
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
    price: 28900,
    category: "bowls",
    kcal: 380,
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
    price: 30900,
    category: "bowls",
    kcal: 390,
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
    price: 27900,
    category: "bowls",
    kcal: 300,
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
    price: 15900,
    category: "coldbrew",
    kcal: 45,
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
    price: 16900,
    category: "coldbrew",
    kcal: 60,
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
    price: 8900,
    category: "extras",
    kcal: 25,
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
    price: 29900,
    category: "extras",
    kcal: 420,
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

export const stores: Store[] = [
  {
    id: "chapinero",
    name: "Blend Chapinero",
    address: "Carrera 11 #69-24, Chapinero",
    area: "Chapinero",
    hours: "7:00 – 21:00",
    phone: "+57 601 400 1180",
    x: 38,
    y: 46,
    services: ["Barra de matcha", "Pedido para llevar", "Pet friendly"],
  },
  {
    id: "usaquen",
    name: "Blend Usaquén",
    address: "Carrera 6 #117-30, Usaquén",
    area: "Usaquén",
    hours: "8:00 – 21:00",
    phone: "+57 601 400 1182",
    x: 63,
    y: 22,
    services: ["Pedido en 10 min", "Parqueadero", "Catering"],
  },
  {
    id: "parque93",
    name: "Blend Parque 93",
    address: "Calle 93B #12-48, Chicó",
    area: "Parque 93",
    hours: "7:30 – 20:30",
    phone: "+57 601 400 1181",
    x: 19,
    y: 60,
    services: ["Terraza", "Bowls hasta las 18:00", "Wi-Fi"],
  },
  {
    id: "candelaria",
    name: "Blend La Candelaria",
    address: "Calle 12C #2-38, La Candelaria",
    area: "Candelaria",
    hours: "8:00 – 20:00",
    phone: "+57 601 400 1183",
    x: 76,
    y: 62,
    services: ["Patio", "Granola a granel", "Pet friendly"],
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
    eyebrow: "Cuatro tiendas",
    title: "Dónde nos",
    accent: "encuentras",
    body: "Toca un pin para ver horarios y cómo llegar. Todas hacen pedido para llevar.",
  },
  contact: {
    eyebrow: "Contacto",
    title: "Escríbenos y",
    accent: "contestamos",
    body: "Barra abierta de 7:00 a 21:00. Los mensajes fuera de horario se responden a la mañana siguiente.",
  },
};

export type Step = { title: string; body: string; color: string };

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

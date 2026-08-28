import { totals, type CartLine, type DeliveryMode } from "./cart";
import type { Product, Store } from "./content";

/**
 * Pedidos. Viven en localStorage hasta que entre la base de datos (fase 7).
 * Se avisa por evento para que el tablero se entere de un pedido nuevo tanto si
 * llegó desde otra pestaña como desde esta misma.
 */

export const STATUSES = ["nuevo", "preparando", "listo", "entregado"] as const;
export type OrderStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  preparando: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
};

/** Lo que se hace con un pedido en cada estado. */
export const STATUS_ACTION: Record<OrderStatus, string | null> = {
  nuevo: "Empezar",
  preparando: "Marcar listo",
  listo: "Marcar entregado",
  entregado: null,
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  nuevo: "#FF6A1A",
  preparando: "#7B3FF2",
  listo: "#8FD14F",
  entregado: "#8A7BA0",
};

/** Minutos a partir de los cuales el pedido se marca en rojo. */
export const LATE_AFTER: Record<OrderStatus, number> = {
  nuevo: 3,
  preparando: 8,
  listo: 12,
  entregado: Infinity,
};

export type Customer = {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
};

export type Order = {
  id: string;
  createdAt: number;
  /** Momento en que entró al estado actual. */
  statusAt: number;
  status: OrderStatus;
  mode: DeliveryMode;
  storeId: string;
  customer: Customer;
  lines: CartLine[];
  subtotal: number;
  delivery: number;
  total: number;
  payment: "tarjeta" | "efectivo" | "pendiente";
  channel: "web" | "mostrador";
};

const KEY = "blend.orders.v1";
const COUNTER_KEY = "blend.orders.counter";
const EVENT = "blend:orders";

export function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Order[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeOrders(list: Order[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* almacenamiento no disponible */
  }
  // `storage` no se dispara en la pestaña que escribe; este evento sí.
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Avisa de cambios propios y de otras pestañas. */
export function subscribeOrders(fn: () => void) {
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

function nextId() {
  let n = 1042;
  try {
    n = Number(localStorage.getItem(COUNTER_KEY) ?? 1042) + 1;
    localStorage.setItem(COUNTER_KEY, String(n));
  } catch {
    n = Math.floor(Math.random() * 9000) + 1000;
  }
  return `B-${n}`;
}

export type NewOrder = {
  lines: CartLine[];
  mode: DeliveryMode;
  storeId: string;
  customer: Customer;
  payment?: Order["payment"];
  channel?: Order["channel"];
};

export function createOrder(input: NewOrder): Order {
  const t = totals(input.lines, input.mode);
  const now = Date.now();
  const order: Order = {
    id: nextId(),
    createdAt: now,
    statusAt: now,
    status: "nuevo",
    mode: input.mode,
    storeId: input.storeId,
    customer: input.customer,
    lines: input.lines,
    subtotal: t.subtotal,
    delivery: t.delivery,
    total: t.total,
    payment: input.payment ?? "pendiente",
    channel: input.channel ?? "web",
  };
  writeOrders([order, ...readOrders()]);
  return order;
}

export function setOrderStatus(id: string, status: OrderStatus) {
  writeOrders(readOrders().map((o) => (o.id === id ? { ...o, status, statusAt: Date.now() } : o)));
}

export function removeOrder(id: string) {
  writeOrders(readOrders().filter((o) => o.id !== id));
}

export function clearOrders() {
  writeOrders([]);
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUSES.indexOf(status);
  return i < STATUSES.length - 1 ? STATUSES[i + 1] : null;
}

export function prevStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUSES.indexOf(status);
  return i > 0 ? STATUSES[i - 1] : null;
}

/** Marca lo que la barra no puede pasar por alto. */
const ALERT_WORDS = ["alergia", "alérgic", "sin gluten", "celiac", "intoleran"];

export function alertsOf(order: Order): string[] {
  const found: string[] = [];
  const scan = (text?: string) => {
    if (!text) return;
    const low = text.toLowerCase();
    if (ALERT_WORDS.some((w) => low.includes(w))) found.push(text.trim());
  };
  scan(order.customer.notes);
  order.lines.forEach((l) => scan(l.options?.note));
  return found;
}

export function elapsedMinutes(from: number, now: number) {
  return Math.floor((now - from) / 60000);
}

export function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

/** Un pedido de ejemplo para probar el tablero sin pasar por la tienda. */
export function demoOrder(products: Product[], stores: Store[]): NewOrder {
  const pool = products.filter((p) => p.category !== "extras" && !p.soldOut);
  if (pool.length === 0 || stores.length === 0) {
    throw new Error("Hace falta al menos una bebida y una sede para crear un pedido de prueba.");
  }
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const names = ["Camila Ruiz", "Andrés Peña", "Valentina Gómez", "Julián Mora", "Sara Cárdenas"];
  const addresses = [
    "Calle 70 #11-32, apto 402",
    "Carrera 13 #85-19, oficina 3",
    "Calle 116 #15-40, torre B",
    "Carrera 7 #45-08",
  ];
  const notes = ["", "", "Sin popote, gracias", "Alergia a la nuez", "Tocar el timbre 2 veces"];
  const mode: DeliveryMode = Math.random() > 0.4 ? "envio" : "recoger";

  const lines: CartLine[] = Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => {
    const p = pick();
    const grande = Math.random() > 0.5;
    return {
      key: `${p.id}-${Math.random().toString(36).slice(2, 7)}`,
      productId: p.id,
      name: p.name,
      color: p.color,
      basePrice: p.price,
      unitPrice: p.price + (grande ? 4500 : 0),
      qty: 1 + Math.floor(Math.random() * 2),
      options: {
        size: grande ? "grande" : "chico",
        base: "Leche de avena",
        sweet: "normal",
        extras: Math.random() > 0.6 ? ["Granola de la casa"] : [],
        note: "",
      },
    };
  });

  return {
    lines,
    mode,
    storeId: stores[Math.floor(Math.random() * stores.length)].id,
    customer: {
      name: names[Math.floor(Math.random() * names.length)],
      phone: `31${Math.floor(Math.random() * 9)} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
      address:
        mode === "envio" ? addresses[Math.floor(Math.random() * addresses.length)] : undefined,
      notes: notes[Math.floor(Math.random() * notes.length)],
    },
    payment: Math.random() > 0.3 ? "tarjeta" : "efectivo",
    channel: "web",
  };
}

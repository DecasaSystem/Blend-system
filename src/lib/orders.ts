import type { CartLine, DeliveryMode } from "./cart";
import type { Product, Store } from "./content";

/**
 * Pedidos: tipos y ayudas que comparten el servidor y el navegador.
 * Leer y escribir vive en `src/actions/orders.ts`, contra Postgres.
 */

/** Las cuatro columnas del tablero. */
export const STATUSES = ["nuevo", "preparando", "listo", "entregado"] as const;

/**
 * `pago` es un estado previo: el pedido existe pero aún no está pagado con
 * tarjeta, así que no aparece en el tablero. La barra no debe ponerse a
 * preparar algo que todavía no se ha cobrado.
 */
export const ALL_STATUSES = ["pago", ...STATUSES] as const;

export type OrderStatus = (typeof ALL_STATUSES)[number];
export type BoardStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pago: "Esperando pago",
  nuevo: "Nuevo",
  preparando: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
};

/** Lo que se hace con un pedido en cada estado. */
export const STATUS_ACTION: Record<OrderStatus, string | null> = {
  pago: null,
  nuevo: "Empezar",
  preparando: "Marcar listo",
  listo: "Marcar entregado",
  entregado: null,
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pago: "#8A7BA0",
  nuevo: "#FF6A1A",
  preparando: "#7B3FF2",
  listo: "#8FD14F",
  entregado: "#8A7BA0",
};

/** Minutos a partir de los cuales el pedido se marca en rojo. */
export const LATE_AFTER: Record<OrderStatus, number> = {
  pago: Infinity,
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

/** Avanzar y retroceder sólo se mueven entre las columnas del tablero. */
export function nextStatus(status: OrderStatus): BoardStatus | null {
  const i = (STATUSES as readonly string[]).indexOf(status);
  return i >= 0 && i < STATUSES.length - 1 ? STATUSES[i + 1] : null;
}

export function prevStatus(status: OrderStatus): BoardStatus | null {
  const i = (STATUSES as readonly string[]).indexOf(status);
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

export type NewOrder = {
  lines: CartLine[];
  mode: DeliveryMode;
  storeId: string;
  customer: Customer;
  payment?: Order["payment"];
  channel?: Order["channel"];
};

/** Un pedido de ejemplo para probar el tablero sin pasar por la tienda. */
export function demoOrder(products: Product[], stores: Store[]): NewOrder {
  const pool = products.filter((p) => p.category !== "extras" && !p.soldOut);
  if (pool.length === 0 || stores.length === 0) {
    throw new Error("Hace falta al menos una bebida y una sede para crear un pedido de prueba.");
  }
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const names = ["Camila Ruiz", "Andrés Peña", "Valentina Gómez", "Julián Mora", "Sara Cárdenas"];
  const addresses = [
    "Cra. 14 #12-40, apto 302",
    "Av. Bolívar #14-25, oficina 3",
    "Calle 21 Norte #18-06, torre B",
    "Cra. 19 #10-55",
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

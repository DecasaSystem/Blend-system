"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { and, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, customers, messages, orders, users } from "@/db/schema";
import { getCustomer, requireCustomer } from "@/lib/customer-session";
import { getSessionUser, requireStaff, requireUser } from "@/lib/session";
import { pushToCustomer, pushToStaff, pushToUser } from "@/lib/push";

/**
 * Chat.
 *
 * Dos clases de hilo, mismas tablas:
 *
 * - `store`: el cliente con la barra. Uno por cliente, como un hilo de
 *   WhatsApp; contesta quien esté en /equipo → Chat.
 * - `delivery`: el cliente con el repartidor de un domicilio concreto. Uno
 *   por pedido, mientras el pedido está vivo: «ya llegué», «no encuentro la
 *   dirección», y la ubicación de cualquiera de los dos en el mapa.
 *
 * Cada acción comprueba en el servidor quién es y de quién es el hilo. Los
 * mensajes son texto plano (React los pinta escapados). Cada mensaje dispara
 * un aviso push al otro lado, después de responder, sin retrasar nada.
 */

export type Sender = "customer" | "staff" | "courier";
export type Location = { lat: number; lng: number };

export type ChatMessage = {
  id: string;
  sender: Sender;
  senderName: string;
  body: string;
  location: Location | null;
  createdAt: number;
};

const MAX_BODY = 1000;
/** Freno contra el spam: mensajes por persona y hilo en cinco minutos. */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 5 * 60_000;

function clean(body: string): string | { error: string } {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) return { error: "Escribe algo." };
  if (text.length > MAX_BODY) return { error: `Máximo ${MAX_BODY} caracteres.` };
  return text;
}

function cleanLocation(loc: unknown): Location | null | { error: string } {
  if (loc == null) return null;
  const l = loc as Partial<Location>;
  if (
    typeof l.lat !== "number" ||
    typeof l.lng !== "number" ||
    !Number.isFinite(l.lat) ||
    !Number.isFinite(l.lng) ||
    Math.abs(l.lat) > 90 ||
    Math.abs(l.lng) > 180
  ) {
    return { error: "La ubicación no es válida." };
  }
  return { lat: Number(l.lat.toFixed(6)), lng: Number(l.lng.toFixed(6)) };
}

const preview = (text: string) => text.replace(/\s+/g, " ").slice(0, 120);

function toMessage(m: typeof messages.$inferSelect): ChatMessage {
  return {
    id: m.id,
    sender: m.sender,
    senderName: m.senderName,
    body: m.body,
    location: m.location ?? null,
    createdAt: m.createdAt.getTime(),
  };
}

async function threadMessages(conversationId: string, limit = 300) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
  return rows.map(toMessage);
}

/** Mensajes de `senders` en el hilo posteriores a la marca de lectura. */
async function unreadSince(conversationId: string, senders: Sender[], readAt: Date | null) {
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.sender, senders),
        gt(messages.createdAt, readAt ?? new Date(0)),
      ),
    );
  return Number(row?.n ?? 0);
}

async function tooFast(conversationId: string, sender: Sender) {
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.sender, sender),
        gt(messages.createdAt, new Date(Date.now() - WINDOW_MS)),
      ),
    );
  return Number(row?.n ?? 0) >= MAX_PER_WINDOW;
}

/** Guarda un mensaje y actualiza el resumen del hilo. */
async function append(
  conversationId: string,
  msg: { sender: Sender; userId?: string | null; senderName: string; body: string; location: Location | null },
  readSide: "customer" | "staff",
) {
  const now = new Date();
  const [saved] = await db
    .insert(messages)
    .values({
      id: randomUUID(),
      conversationId,
      sender: msg.sender,
      userId: msg.userId ?? null,
      senderName: msg.senderName,
      body: msg.body,
      location: msg.location,
      createdAt: now,
    })
    .returning();
  await db
    .update(conversations)
    .set({
      lastMessageAt: now,
      preview: preview(msg.location && !msg.body.trim() ? "📍 Ubicación" : msg.body),
      // Quien escribe ya leyó lo anterior.
      ...(readSide === "customer" ? { customerReadAt: now } : { staffReadAt: now }),
    })
    .where(eq(conversations.id, conversationId));
  return toMessage(saved);
}

/* ------------------------------------------------------------------ */
/* Hilo de tienda: cliente ↔ barra                                     */
/* ------------------------------------------------------------------ */

async function storeConversation(customerId: string, create: boolean) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.customerId, customerId), eq(conversations.kind, "store")))
    .limit(1);
  if (conv || !create) return conv ?? null;
  await db
    .insert(conversations)
    .values({ id: randomUUID(), customerId, kind: "store" })
    .onConflictDoNothing();
  const [made] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.customerId, customerId), eq(conversations.kind, "store")))
    .limit(1);
  return made;
}

/** La conversación con la barra de quien está en sesión. Null si no hay sesión. */
export async function myChat(
  markRead = false,
): Promise<{ messages: ChatMessage[]; unread: number } | null> {
  const customer = await getCustomer();
  if (!customer) return null;
  const conv = await storeConversation(customer.id, false);
  if (!conv) return { messages: [], unread: 0 };

  const rows = await threadMessages(conv.id);
  const since = conv.customerReadAt?.getTime() ?? 0;
  const unread = rows.filter((m) => m.sender === "staff" && m.createdAt > since).length;
  if (markRead && unread > 0) {
    await db
      .update(conversations)
      .set({ customerReadAt: new Date() })
      .where(eq(conversations.id, conv.id));
  }
  return { messages: rows, unread: markRead ? 0 : unread };
}

export async function sendMyMessage(
  body: string,
): Promise<{ ok: true; message: ChatMessage } | { error: string }> {
  const customer = await requireCustomer();
  const text = clean(body);
  if (typeof text !== "string") return text;
  const conv = await storeConversation(customer.id, true);
  if (!conv) return { error: "No se pudo abrir la conversación." };
  if (await tooFast(conv.id, "customer")) {
    return { error: "Has enviado muchos mensajes seguidos. Espera un momento." };
  }
  const message = await append(
    conv.id,
    { sender: "customer", senderName: customer.name, body: text, location: null },
    "customer",
  );
  after(() =>
    pushToStaff({
      title: `${customer.name} escribió`,
      body: preview(text),
      url: "/equipo?ver=chat",
      tag: `chat-${conv.id}`,
    }),
  );
  return { ok: true, message };
}

/* ------------------------------------------------------------------ */
/* Hilos de reparto: cliente ↔ repartidor                              */
/* ------------------------------------------------------------------ */

export type DeliveryThread = {
  orderId: string;
  courierName: string | null;
  status: string;
  outAt: number | null;
  unread: number;
};

/** Los domicilios vivos del cliente en sesión con repartidor, para las pestañas de la burbuja. */
async function activeDeliveries(customerId: string) {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      outAt: orders.outAt,
      statusAt: orders.statusAt,
      courierId: orders.courierId,
      courierName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.courierId, users.id))
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.mode, "envio"),
        or(
          inArray(orders.status, ["nuevo", "preparando", "listo"]),
          // Recién entregado: el hilo sigue una hora, por si hay que decir algo.
          and(eq(orders.status, "entregado"), gt(orders.statusAt, new Date(Date.now() - 3600_000))),
        ),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(5);
}

/** Lo que la burbuja necesita para pintar sus pestañas y el globo total. */
export async function myThreads(): Promise<{
  storeUnread: number;
  deliveries: DeliveryThread[];
} | null> {
  const customer = await getCustomer();
  if (!customer) return null;

  const conv = await storeConversation(customer.id, false);
  const storeUnread = conv ? await unreadSince(conv.id, ["staff"], conv.customerReadAt) : 0;

  const live = await activeDeliveries(customer.id);
  const deliveries: DeliveryThread[] = [];
  for (const o of live) {
    // Sin repartidor todavía no hay con quién hablar: la barra está en el otro hilo.
    if (!o.courierId) continue;
    const [dc] = await db
      .select({ id: conversations.id, readAt: conversations.customerReadAt })
      .from(conversations)
      .where(eq(conversations.orderId, o.id))
      .limit(1);
    deliveries.push({
      orderId: o.id,
      courierName: o.courierName,
      status: o.status,
      outAt: o.outAt ? o.outAt.getTime() : null,
      unread: dc ? await unreadSince(dc.id, ["courier"], dc.readAt) : 0,
    });
  }
  return { storeUnread, deliveries };
}

/** Sólo el total sin leer, para el globo con el chat cerrado. */
export async function myChatUnread(): Promise<number> {
  const t = await myThreads();
  if (!t) return 0;
  return t.storeUnread + t.deliveries.reduce((n, d) => n + d.unread, 0);
}

/**
 * Quién puede hablar en el hilo de un pedido: el cliente dueño (como
 * `customer`), su repartidor (como `courier`) o un administrador mirando
 * (como `courier`, firmando con su nombre).
 */
async function deliveryParty(orderId: string): Promise<
  | { side: "customer"; customerId: string; name: string; order: typeof orders.$inferSelect }
  | { side: "courier"; userId: string; name: string; order: typeof orders.$inferSelect }
  | null
> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.mode !== "envio") return null;

  const customer = await getCustomer();
  if (customer && order.customerId === customer.id) {
    return { side: "customer", customerId: customer.id, name: customer.name, order };
  }
  const user = await getSessionUser();
  if (user && (order.courierId === user.id || user.role === "admin")) {
    return { side: "courier", userId: user.id, name: user.name, order };
  }
  return null;
}

async function deliveryConversation(order: typeof orders.$inferSelect, create: boolean) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.orderId, order.id))
    .limit(1);
  if (conv || !create || !order.customerId) return conv ?? null;
  await db
    .insert(conversations)
    .values({ id: randomUUID(), customerId: order.customerId, kind: "delivery", orderId: order.id })
    .onConflictDoNothing();
  const [made] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.orderId, order.id))
    .limit(1);
  return made;
}

export async function deliveryChat(
  orderId: string,
  markRead = true,
): Promise<{ messages: ChatMessage[]; side: "customer" | "courier"; courierName: string | null } | null> {
  const party = await deliveryParty(orderId);
  if (!party) return null;
  const conv = await deliveryConversation(party.order, false);
  const [courier] = party.order.courierId
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, party.order.courierId)).limit(1)
    : [];
  if (!conv) return { messages: [], side: party.side, courierName: courier?.name ?? null };

  const rows = await threadMessages(conv.id);
  if (markRead) {
    await db
      .update(conversations)
      .set(party.side === "customer" ? { customerReadAt: new Date() } : { staffReadAt: new Date() })
      .where(eq(conversations.id, conv.id));
  }
  return { messages: rows, side: party.side, courierName: courier?.name ?? null };
}

export async function sendDeliveryMessage(
  orderId: string,
  body: string,
  location?: Location | null,
): Promise<{ ok: true; message: ChatMessage } | { error: string }> {
  const party = await deliveryParty(orderId);
  if (!party) return { error: "Este pedido no es tuyo." };
  if (party.order.status === "entregado" && party.order.statusAt.getTime() < Date.now() - 3600_000) {
    return { error: "Este pedido ya se cerró." };
  }

  const loc = cleanLocation(location);
  if (loc && "error" in loc) return loc;
  const text = body.trim() ? clean(body) : loc ? "📍 Aquí estoy" : { error: "Escribe algo." };
  if (typeof text !== "string") return text;

  const conv = await deliveryConversation(party.order, true);
  if (!conv) return { error: "Este pedido no tiene cuenta de cliente: no hay chat." };

  const sender: Sender = party.side === "customer" ? "customer" : "courier";
  if (await tooFast(conv.id, sender)) {
    return { error: "Muchos mensajes seguidos. Espera un momento." };
  }

  const message = await append(
    conv.id,
    {
      sender,
      userId: party.side === "courier" ? party.userId : null,
      senderName: party.name,
      body: text,
      location: loc,
    },
    party.side === "customer" ? "customer" : "staff",
  );

  const o = party.order;
  after(async () => {
    if (party.side === "courier" && o.customerId) {
      await pushToCustomer(o.customerId, {
        title: `${party.name}, tu repartidor · ${o.id}`,
        body: preview(text),
        url: `/?chat=${o.id}`,
        tag: `delivery-${o.id}`,
      });
    } else if (party.side === "customer" && o.courierId) {
      await pushToUser(o.courierId, {
        title: `${party.name} · ${o.id}`,
        body: preview(text),
        url: `/equipo/reparto?chat=${o.id}`,
        tag: `delivery-${o.id}`,
      });
    }
  });

  return { ok: true, message };
}

/** Para el repartidor: cuántos mensajes sin leer hay por cada pedido suyo. */
export async function courierUnread(): Promise<Record<string, number>> {
  const user = await requireUser();
  const rows = await db
    .select({
      orderId: conversations.orderId,
      n: sql<number>`(
        select count(*)::int from ${messages} m
        where m.conversation_id = ${conversations.id}
          and m.sender = 'customer'
          and m.created_at > coalesce(${conversations.staffReadAt}, 'epoch'::timestamptz)
      )`,
    })
    .from(conversations)
    .innerJoin(orders, eq(conversations.orderId, orders.id))
    .where(
      and(
        eq(conversations.kind, "delivery"),
        eq(orders.courierId, user.id),
        inArray(orders.status, ["nuevo", "preparando", "listo"]),
      ),
    );
  const out: Record<string, number> = {};
  for (const r of rows) if (r.orderId && r.n > 0) out[r.orderId] = r.n;
  return out;
}

/* ------------------------------------------------------------------ */
/* La barra: los hilos de tienda                                       */
/* ------------------------------------------------------------------ */

export type ChatSummary = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  preview: string;
  lastMessageAt: number;
  /** Mensajes del cliente que nadie de la barra ha leído. */
  unread: number;
  /** Si el último mensaje es del cliente: le toca contestar a la barra. */
  awaiting: boolean;
};

export async function listChats(): Promise<ChatSummary[]> {
  await requireStaff();
  const rows = await db
    .select({
      id: conversations.id,
      customerId: conversations.customerId,
      customerName: customers.name,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      preview: conversations.preview,
      lastMessageAt: conversations.lastMessageAt,
      staffReadAt: conversations.staffReadAt,
      lastSender: sql<string | null>`(
        select m.sender from ${messages} m
        where m.conversation_id = ${conversations.id}
        order by m.created_at desc limit 1
      )`,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(and(eq(conversations.kind, "store"), isNull(conversations.orderId)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  const out: ChatSummary[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerPhone: r.customerPhone,
      preview: r.preview,
      lastMessageAt: r.lastMessageAt.getTime(),
      unread: await unreadSince(r.id, ["customer"], r.staffReadAt),
      awaiting: r.lastSender === "customer",
    });
  }
  return out;
}

/** Total sin leer en los hilos de tienda, para la pestaña del panel. */
export async function chatUnreadTotal(): Promise<number> {
  await requireStaff();
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.kind, "store"),
        eq(messages.sender, "customer"),
        sql`${messages.createdAt} > coalesce(${conversations.staffReadAt}, 'epoch'::timestamptz)`,
      ),
    );
  return Number(row?.n ?? 0);
}

export async function chatMessages(conversationId: string, markRead = true): Promise<ChatMessage[]> {
  await requireStaff();
  const rows = await threadMessages(conversationId, 500);
  if (markRead) {
    await db
      .update(conversations)
      .set({ staffReadAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
  return rows;
}

export async function replyChat(
  conversationId: string,
  body: string,
): Promise<{ ok: true; message: ChatMessage } | { error: string }> {
  const user = await requireStaff();
  const text = clean(body);
  if (typeof text !== "string") return text;

  const [conv] = await db
    .select({ id: conversations.id, customerId: conversations.customerId, kind: conversations.kind })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv || conv.kind !== "store") return { error: "Esa conversación ya no existe." };

  const message = await append(
    conv.id,
    { sender: "staff", userId: user.id, senderName: user.name, body: text, location: null },
    "staff",
  );
  after(() =>
    pushToCustomer(conv.customerId, {
      title: `${user.name}, de BLEND`,
      body: preview(text),
      url: "/?chat=store",
      tag: `chat-${conv.id}`,
    }),
  );
  return { ok: true, message };
}

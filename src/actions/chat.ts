"use server";

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, customers, messages } from "@/db/schema";
import { getCustomer, requireCustomer } from "@/lib/customer-session";
import { requireStaff } from "@/lib/session";

/**
 * Chat cliente ↔ barra.
 *
 * Dos lados y una regla en cada uno: el cliente sólo ve y escribe en su
 * propia conversación (la de su sesión); la barra ve todas. Todo se comprueba
 * aquí, en el servidor. Los mensajes son texto plano: React los pinta
 * escapados, así que nada de lo que escriba nadie se ejecuta.
 *
 * No hay tiempo real: la tienda y el panel preguntan cada pocos segundos,
 * igual que el tablero de pedidos. Menos piezas, y funciona en cualquier
 * despliegue.
 */

export type ChatMessage = {
  id: string;
  sender: "customer" | "staff";
  senderName: string;
  body: string;
  createdAt: number;
};

const MAX_BODY = 1000;
/** Freno contra el spam: mensajes por cliente en cinco minutos. */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 5 * 60_000;

function clean(body: string): string | { error: string } {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) return { error: "Escribe algo." };
  if (text.length > MAX_BODY) return { error: `Máximo ${MAX_BODY} caracteres.` };
  return text;
}

const preview = (text: string) => text.replace(/\s+/g, " ").slice(0, 120);

function toMessage(m: typeof messages.$inferSelect): ChatMessage {
  return {
    id: m.id,
    sender: m.sender,
    senderName: m.senderName,
    body: m.body,
    createdAt: m.createdAt.getTime(),
  };
}

/* ------------------------------------------------------------------ */
/* El cliente                                                          */
/* ------------------------------------------------------------------ */

/** La conversación de quien está en sesión. Null si no hay sesión. */
export async function myChat(
  markRead = false,
): Promise<{ messages: ChatMessage[]; unread: number } | null> {
  const customer = await getCustomer();
  if (!customer) return null;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.customerId, customer.id))
    .limit(1);
  if (!conv) return { messages: [], unread: 0 };

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt)
    .limit(200);

  const since = conv.customerReadAt?.getTime() ?? 0;
  const unread = rows.filter((m) => m.sender === "staff" && m.createdAt.getTime() > since).length;

  if (markRead && unread > 0) {
    await db
      .update(conversations)
      .set({ customerReadAt: new Date() })
      .where(eq(conversations.id, conv.id));
  }

  return { messages: rows.map(toMessage), unread: markRead ? 0 : unread };
}

/** Sólo cuántos hay sin leer: para la burbuja cuando el chat está cerrado. */
export async function myChatUnread(): Promise<number> {
  const customer = await getCustomer();
  if (!customer) return 0;
  const [conv] = await db
    .select({ id: conversations.id, readAt: conversations.customerReadAt })
    .from(conversations)
    .where(eq(conversations.customerId, customer.id))
    .limit(1);
  if (!conv) return 0;
  return unreadSince(conv.id, "staff", conv.readAt);
}

/** Mensajes de `sender` en la conversación posteriores a la marca de lectura. */
async function unreadSince(
  conversationId: string,
  sender: "customer" | "staff",
  readAt: Date | null,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.sender, sender),
        gt(messages.createdAt, readAt ?? new Date(0)),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function sendMyMessage(
  body: string,
): Promise<{ ok: true; message: ChatMessage } | { error: string }> {
  const customer = await requireCustomer();
  const text = clean(body);
  if (typeof text !== "string") return text;

  // La conversación se crea con el primer mensaje.
  let [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.customerId, customer.id))
    .limit(1);
  if (!conv) {
    [conv] = await db
      .insert(conversations)
      .values({ id: randomUUID(), customerId: customer.id })
      .onConflictDoNothing()
      .returning({ id: conversations.id });
    if (!conv) {
      [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.customerId, customer.id))
        .limit(1);
    }
  }

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conv.id),
        eq(messages.sender, "customer"),
        gt(messages.createdAt, new Date(Date.now() - WINDOW_MS)),
      ),
    );
  if (recent >= MAX_PER_WINDOW) {
    return { error: "Has enviado muchos mensajes seguidos. Espera un momento." };
  }

  const now = new Date();
  const [saved] = await db
    .insert(messages)
    .values({
      id: randomUUID(),
      conversationId: conv.id,
      sender: "customer",
      senderName: customer.name,
      body: text,
      createdAt: now,
    })
    .returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: now, preview: preview(text), customerReadAt: now })
    .where(eq(conversations.id, conv.id));

  return { ok: true, message: toMessage(saved) };
}

/* ------------------------------------------------------------------ */
/* La barra                                                            */
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

const unreadForStaff = sql<number>`(
  select count(*)::int from ${messages} m
  where m.conversation_id = ${conversations.id}
    and m.sender = 'customer'
    and m.created_at > coalesce(${conversations.staffReadAt}, 'epoch'::timestamptz)
)`;

const lastSender = sql<string | null>`(
  select m.sender from ${messages} m
  where m.conversation_id = ${conversations.id}
  order by m.created_at desc limit 1
)`;

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
      unread: unreadForStaff,
      lastSender,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    preview: r.preview,
    lastMessageAt: r.lastMessageAt.getTime(),
    unread: r.unread,
    awaiting: r.lastSender === "customer",
  }));
}

/** Total sin leer, para la pestaña del panel. */
export async function chatUnreadTotal(): Promise<number> {
  await requireStaff();
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(messages.sender, "customer"),
        sql`${messages.createdAt} > coalesce(${conversations.staffReadAt}, 'epoch'::timestamptz)`,
      ),
    );
  return Number(row?.n ?? 0);
}

export async function chatMessages(
  conversationId: string,
  markRead = true,
): Promise<ChatMessage[]> {
  await requireStaff();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(500);
  if (markRead) {
    await db
      .update(conversations)
      .set({ staffReadAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
  return rows.map(toMessage);
}

export async function replyChat(
  conversationId: string,
  body: string,
): Promise<{ ok: true; message: ChatMessage } | { error: string }> {
  const user = await requireStaff();
  const text = clean(body);
  if (typeof text !== "string") return text;

  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return { error: "Esa conversación ya no existe." };

  const now = new Date();
  const [saved] = await db
    .insert(messages)
    .values({
      id: randomUUID(),
      conversationId,
      sender: "staff",
      userId: user.id,
      senderName: user.name,
      body: text,
      createdAt: now,
    })
    .returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: now, preview: preview(text), staffReadAt: now })
    .where(eq(conversations.id, conversationId));

  return { ok: true, message: toMessage(saved) };
}

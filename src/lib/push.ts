import "server-only";

import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";

/**
 * Notificaciones push (Web Push).
 *
 * El navegador del cliente o del equipo se suscribe una vez (con permiso) y
 * desde entonces se le pueden mandar avisos aunque tenga la página cerrada:
 * «te respondieron», «tu pedido va en camino», «pedido nuevo». Funciona en
 * Chrome/Edge/Firefox de escritorio y Android; en iPhone sólo si la tienda
 * está instalada en la pantalla de inicio (iOS 16.4+).
 *
 * Las llaves VAPID identifican a la tienda ante los servicios de push. Sin
 * ellas, nada de esto hace nada y la tienda funciona igual.
 */

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:hola@blendlabco.co";

let configured = false;
function setup() {
  if (configured) return true;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushEnabled() {
  return Boolean(publicKey && privateKey);
}

export type PushPayload = {
  title: string;
  body: string;
  /** A dónde lleva tocar el aviso. */
  url?: string;
  /** Los avisos con la misma etiqueta se sustituyen en vez de apilarse. */
  tag?: string;
};

export type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Guarda (o refresca) la suscripción de un aparato, atada a quien está en sesión. */
export async function saveSubscription(
  sub: SubscriptionInput,
  owner: { customerId?: string | null; userId?: string | null },
  userAgent?: string | null,
) {
  if (!sub.endpoint.startsWith("https://")) throw new Error("Suscripción inválida.");
  await db
    .insert(pushSubscriptions)
    .values({
      id: randomUUID(),
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      customerId: owner.customerId ?? null,
      userId: owner.userId ?? null,
      userAgent: userAgent?.slice(0, 200) ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        // Si ahora entra otra persona en el mismo navegador, el aparato pasa
        // a ser suyo: los avisos son de quien tiene la sesión.
        customerId: owner.customerId ?? null,
        userId: owner.userId ?? null,
        userAgent: userAgent?.slice(0, 200) ?? null,
      },
    });
}

export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** ¿Hay algún aparato de esta persona suscrito? Para pintar el botón. */
export async function hasSubscription(owner: { customerId?: string; userId?: string }) {
  const conds = [];
  if (owner.customerId) conds.push(eq(pushSubscriptions.customerId, owner.customerId));
  if (owner.userId) conds.push(eq(pushSubscriptions.userId, owner.userId));
  if (conds.length === 0) return false;
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(or(...conds))
    .limit(1);
  return rows.length > 0;
}

type Row = typeof pushSubscriptions.$inferSelect;

/**
 * Manda el aviso a cada aparato. Nunca lanza: un aviso que no llega no puede
 * tumbar la acción que lo originó. Las suscripciones muertas se borran.
 */
async function deliver(rows: Row[], payload: PushPayload) {
  if (!setup() || rows.length === 0) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          body,
          { TTL: 60 * 60, urgency: "high" },
        );
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, r.id));
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, r.id));
        } else {
          console.warn("[push] no se pudo entregar:", status ?? err);
        }
      }
    }),
  );
}

export async function pushToCustomer(customerId: string, payload: PushPayload) {
  if (!pushEnabled()) return;
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.customerId, customerId));
  await deliver(rows, payload);
}

export async function pushToUser(userId: string, payload: PushPayload) {
  if (!pushEnabled()) return;
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  await deliver(rows, payload);
}

/** A toda la barra (barra y administradores), no a los repartidores. */
export async function pushToStaff(payload: PushPayload) {
  if (!pushEnabled()) return;
  const staff = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ["barra", "admin"]));
  if (staff.length === 0) return;
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(
      inArray(
        pushSubscriptions.userId,
        staff.map((u) => u.id),
      ),
    );
  await deliver(rows, payload);
}

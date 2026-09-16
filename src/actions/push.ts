"use server";

import { headers } from "next/headers";
import { getCustomer } from "@/lib/customer-session";
import { getSessionUser } from "@/lib/session";
import {
  hasSubscription,
  pushEnabled,
  removeSubscription,
  saveSubscription,
  type SubscriptionInput,
} from "@/lib/push";

/**
 * Suscribirse a los avisos desde el navegador.
 *
 * La suscripción queda atada a quien esté en sesión en ese momento: el
 * cliente de la tienda, o la persona del equipo (barra, admin o repartidor).
 * Si hay las dos sesiones en el mismo navegador, se guardan las dos: es el
 * caso de alguien del equipo que también compra.
 */

export async function pushStatus(): Promise<{
  enabled: boolean;
  publicKey: string | null;
  subscribed: boolean;
}> {
  const enabled = pushEnabled();
  if (!enabled) return { enabled: false, publicKey: null, subscribed: false };
  const [customer, user] = await Promise.all([getCustomer(), getSessionUser()]);
  const subscribed = await hasSubscription({ customerId: customer?.id, userId: user?.id });
  return { enabled, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null, subscribed };
}

export async function subscribePush(
  sub: SubscriptionInput,
): Promise<{ ok: true } | { error: string }> {
  if (!pushEnabled()) return { error: "Los avisos no están configurados." };
  const [customer, user] = await Promise.all([getCustomer(), getSessionUser()]);
  if (!customer && !user) return { error: "Entra a tu cuenta para activar los avisos." };
  if (typeof sub?.endpoint !== "string" || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: "Suscripción inválida." };
  }
  const ua = (await headers()).get("user-agent");
  await saveSubscription(sub, { customerId: customer?.id, userId: user?.id }, ua);
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<{ ok: true }> {
  if (typeof endpoint === "string") await removeSubscription(endpoint);
  return { ok: true };
}

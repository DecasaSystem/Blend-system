"use client";

import { useCallback, useEffect, useState } from "react";
import { pushStatus, subscribePush, unsubscribePush } from "@/actions/push";

/**
 * Activar o quitar los avisos en este aparato.
 *
 * Pasa por los tres permisos que hacen falta: el service worker, el permiso
 * de notificaciones del navegador y la suscripción push, y guarda ésta en el
 * servidor atada a la sesión. Si el navegador no puede (Safari de iPhone sin
 * instalar la app, o un navegador viejo), lo dice en vez de fallar callado.
 *
 * Es el mismo botón para clientes, barra y repartidores; cambia el texto.
 */

export type PushState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "denied"
  | "off"
  | "on"
  | "disabled";

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (typeof window === "undefined") return;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(ios && !standalone ? "ios-install" : "unsupported");
      return;
    }
    const status = await pushStatus().catch(() => null);
    if (!status || !status.enabled) {
      setState("disabled");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    // Suscrito en ESTE aparato: lo que importa para el botón.
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    setState(sub && status.subscribed ? "on" : "off");
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const enable = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const status = await pushStatus();
      if (!status.enabled || !status.publicKey) return "Los avisos no están configurados.";
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return permission === "denied"
          ? "El navegador tiene los avisos bloqueados para esta página."
          : null;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toKey(status.publicKey),
        }));
      const json = sub.toJSON();
      const res = await subscribePush({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      if ("error" in res) return res.error;
      setState("on");
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "No se pudieron activar los avisos.";
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable, refresh: check };
}

/** La llave pública VAPID viene en base64url; el navegador la quiere en bytes. */
function toKey(base64url: string) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * El botón. `tone` cambia el aspecto según dónde esté (fondo claro u oscuro);
 * `what` es lo que se va a avisar, para que el texto tenga sentido.
 */
export default function PushToggle({
  what = "cuando te respondan o tu pedido avance",
  tone = "light",
  compact = false,
}: {
  what?: string;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const { state, busy, enable, disable } = usePush();
  const [error, setError] = useState<string | null>(null);

  if (state === "loading" || state === "disabled") return null;

  const base = compact
    ? "u-mono inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] px-3.5"
    : "u-mono inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4";
  const idle =
    tone === "dark"
      ? "border-paper/30 text-paper/80 hover:border-paper"
      : "border-ink/25 text-ink/65 hover:border-ink hover:text-ink";
  const active = tone === "dark" ? "border-paper bg-paper text-ink" : "border-ink bg-ink text-paper";

  if (state === "unsupported" || state === "ios-install" || state === "denied") {
    const msg =
      state === "ios-install"
        ? "En iPhone los avisos sólo funcionan con la app instalada (Compartir → Añadir a pantalla de inicio)."
        : state === "denied"
          ? "Los avisos están bloqueados en este navegador: actívalos en los ajustes del sitio."
          : "Este navegador no admite avisos.";
    const short =
      state === "ios-install" ? "Avisos: instala la app" : state === "denied" ? "Avisos bloqueados" : "Sin avisos";
    // En una cabecera no cabe la explicación: va en el título, al mantener el dedo.
    if (compact) {
      return (
        <span
          title={msg}
          className={`u-mono inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] px-3.5 ${
            tone === "dark" ? "border-paper/20 text-paper/50" : "border-ink/15 text-ink/40"
          }`}
        >
          <span aria-hidden="true">🔕</span>
          {short}
        </span>
      );
    }
    return <p className={`u-mono normal-case tracking-[0.01em] ${tone === "dark" ? "text-paper/55" : "text-ink/45"}`}>{msg}</p>;
  }

  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError(null);
          if (state === "on") return disable();
          setError(await enable());
        }}
        aria-pressed={state === "on"}
        className={`${base} transition-colors disabled:opacity-60 ${state === "on" ? active : idle}`}
      >
        <span aria-hidden="true">{state === "on" ? "🔔" : "🔕"}</span>
        {busy ? "Un momento…" : state === "on" ? "Avisos activados" : "Activar avisos"}
      </button>
      {!compact && state !== "on" ? (
        <p className={`u-mono normal-case tracking-[0.01em] ${tone === "dark" ? "text-paper/50" : "text-ink/40"}`}>
          Te avisamos en este aparato {what}, aunque tengas la página cerrada.
        </p>
      ) : null}
      {error ? (
        <p className="u-mono normal-case tracking-[0.01em] text-mango-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

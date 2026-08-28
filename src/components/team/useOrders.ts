"use client";

import { useEffect, useRef, useState } from "react";
import { readOrders, subscribeOrders, type Order } from "@/lib/orders";

/** Los pedidos guardados, al día con lo que pase en cualquier pestaña. */
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setOrders(readOrders());
    sync();
    setReady(true);
    return subscribeOrders(sync);
  }, []);

  return { orders, ready };
}

/**
 * Ancho de pantalla como estado, para renderizar UN solo diseño.
 * Con `hidden lg:grid` los dos árboles existirían y cada pedido saldría dos
 * veces en el DOM y para los lectores de pantalla.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

/** Un reloj compartido: un solo intervalo para todos los cronómetros. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Avisa cuando entra un pedido que no estaba antes.
 * Ignora la primera carga: al abrir el tablero no debe sonar por lo que ya había.
 */
export function useNewOrderAlert(orders: Order[], enabled: boolean) {
  const known = useRef<Set<string> | null>(null);
  const [arrived, setArrived] = useState<Order | null>(null);

  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));

    if (known.current === null) {
      known.current = ids;
      return;
    }

    const fresh = orders.find((o) => !known.current!.has(o.id));
    known.current = ids;
    if (!fresh) return;

    setArrived(fresh);
    const t = setTimeout(() => setArrived(null), 6000);

    if (enabled) {
      chime();
      notify(fresh.id, fresh.customer.name);
    }
    return () => clearTimeout(t);
  }, [orders, enabled]);

  return arrived;
}

/** Campanilla generada al vuelo: sin archivos de audio que cargar. */
export function chime() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const at = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.45);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* el navegador puede bloquear el audio hasta que haya interacción */
  }
}

function notify(id: string, name: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(`Pedido ${id}`, { body: `${name} · toca para verlo`, tag: id });
  } catch {
    /* notificaciones no disponibles */
  }
}

export async function askForNotifications() {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

"use client";

import { useEffect, useRef, useState } from "react";
import { clearPosition, reportPosition } from "@/actions/tracking";
import { distanceMeters, type LatLng } from "@/lib/geo";

/**
 * Mandar dónde va la moto mientras tenga un domicilio en la calle.
 *
 * Se enciende solo cuando `active` pasa a verdadero (hay algo «en camino») y
 * se apaga solo cuando vuelve a falso: no hay botón que el repartidor pueda
 * olvidar. Mientras está encendido:
 *
 * - `watchPosition` con alta precisión. Cada punto se manda si la moto se
 *   movió más de unos metros o si pasó un rato sin mandar nada (para que el
 *   cliente vea que sigue vivo aunque esté parado en un semáforo).
 * - Pide al sistema que no apague la pantalla (Wake Lock). Es lo que de
 *   verdad marca la diferencia: en el celular, con la pantalla apagada, el
 *   navegador deja de dar GPS. Con la app instalada y el celular en el
 *   soporte de la moto, esto la mantiene encendida hasta entregar.
 *
 * Si el sistema quita el wake lock (por ejemplo al cambiar de app), se
 * vuelve a pedir al volver a la pantalla.
 */

const MIN_MOVE_M = 15;
const MIN_SEND_MS = 5000;
const HEARTBEAT_MS = 30000;

export type TrackingState =
  | { kind: "apagado" }
  | { kind: "buscando" }
  | { kind: "enviando"; at: number }
  | { kind: "sin-permiso" }
  | { kind: "sin-gps" }
  | { kind: "error"; message: string };

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (t: "release", f: () => void) => void };

export function useCourierTracking(active: boolean): TrackingState {
  const [state, setState] = useState<TrackingState>({ kind: "apagado" });
  const last = useRef<{ pos: LatLng; at: number } | null>(null);
  const inFlight = useRef(false);
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      setState({ kind: "apagado" });
      last.current = null;
      // Al quedarse sin domicilios el servidor ya borró la fila; esto cubre
      // el caso de que el último cierre lo haya hecho la barra.
      if (wasActive.current) clearPosition().catch(() => {});
      wasActive.current = false;
      return;
    }
    wasActive.current = true;

    if (!("geolocation" in navigator)) {
      setState({ kind: "sin-gps" });
      return;
    }
    setState({ kind: "buscando" });

    let disposed = false;

    const send = async (pos: LatLng, heading: number | null, force = false) => {
      const now = Date.now();
      const prev = last.current;
      const moved = !prev || distanceMeters(prev.pos, pos) >= MIN_MOVE_M;
      const fresh = prev && now - prev.at < MIN_SEND_MS;
      const stale = prev && now - prev.at >= HEARTBEAT_MS;
      if (!force && !stale && (!moved || fresh)) return;
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await reportPosition({ lat: pos.lat, lng: pos.lng, heading });
        if (disposed) return;
        if ("error" in res) {
          setState({ kind: "error", message: res.error });
          return;
        }
        last.current = { pos, at: now };
        setState({ kind: "enviando", at: now });
      } catch {
        if (!disposed) setState({ kind: "error", message: "Sin conexión. Se vuelve a intentar solo." });
      } finally {
        inFlight.current = false;
      }
    };

    // 1. GPS.
    let latest: { pos: LatLng; heading: number | null } | null = null;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const heading =
          typeof p.coords.heading === "number" && Number.isFinite(p.coords.heading)
            ? p.coords.heading
            : null;
        latest = { pos: { lat: p.coords.latitude, lng: p.coords.longitude }, heading };
        send(latest.pos, latest.heading);
      },
      (err) => {
        if (disposed) return;
        if (err.code === err.PERMISSION_DENIED) setState({ kind: "sin-permiso" });
        else setState({ kind: "error", message: "No se pudo leer la ubicación." });
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );

    // Latido: parado en un semáforo `watchPosition` calla; mandar el último
    // punto de todos modos para que el cliente sepa que sigue ahí.
    const beat = setInterval(() => {
      if (latest) send(latest.pos, latest.heading);
    }, HEARTBEAT_MS);

    // 2. Pantalla encendida.
    let lock: WakeLockSentinel | null = null;
    const wake = async () => {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } })
        .wakeLock;
      if (!wl || document.visibilityState !== "visible") return;
      try {
        lock = await wl.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // Batería baja o política del sistema: no pasa nada, sólo no se sostiene.
      }
    };
    wake();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (!lock) wake();
        // Al volver, mandar ya: el cliente lleva un rato sin ver nada.
        if (latest) send(latest.pos, latest.heading, true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);

  return state;
}

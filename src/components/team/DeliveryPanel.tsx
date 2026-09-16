"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "../Logo";
import { useSite } from "../SiteProvider";
import { chime, useNow } from "./useOrders";
import { describe, money } from "@/lib/cart";
import { alertsOf, elapsedMinutes, formatClock, type Order } from "@/lib/orders";
import {
  completeDelivery,
  myDeliveries,
  releaseDelivery,
  startDelivery,
  takeDelivery,
  type DeliveryBoard,
} from "@/actions/delivery";
import { signOut } from "@/actions/auth";
import type { SessionUser } from "@/lib/session";
import type { Size } from "@/lib/content";

/**
 * La pantalla del repartidor.
 *
 * Es para el celular, con una mano y en la calle: pocas cosas grandes.
 * Tres listas —lo mío, lo disponible, lo entregado hoy— y en cada tarjeta lo
 * que hace falta para entregar: nombre, dirección (con botón al mapa),
 * teléfono (con botón de llamar), qué lleva y si está pagado.
 *
 * Los domicilios se pagan en línea siempre, así que lo normal es que todo
 * diga «Pagado». Si alguno no lo está —un pedido viejo, o la pasarela caída—
 * se avisa en naranja para que cobre al entregar.
 *
 * Se refresca sola cada pocos segundos; cuando aparece un pedido nuevo para
 * mí, suena.
 */

const REFRESH_MS = 5000;

export default function DeliveryPanel({
  user,
  initial,
}: {
  user: SessionUser;
  initial: DeliveryBoard;
}) {
  const { stores, sizes, brand } = useSite();
  const [board, setBoard] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(10000);
  const known = useRef(new Set(initial.mine.map((o) => o.id)));
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await myDeliveries();
      // Suena si me asignaron algo que no tenía.
      if (next.mine.some((o) => !known.current.has(o.id))) chime();
      known.current = new Set(next.mine.map((o) => o.id));
      setBoard(next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const run = async (id: string, fn: () => Promise<{ ok: true } | { error: string }>) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fn();
      if ("error" in res) setError(res.error);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const saliendo = board.mine.filter((o) => !o.outAt);
  const enCamino = board.mine.filter((o) => o.outAt);

  return (
    <main className="min-h-svh bg-paper-2 pb-16">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Logo size={30} />
          <div className="min-w-0">
            <p className="u-display text-xl leading-none">Reparto</p>
            <p className="u-mono truncate text-ink/45">{user.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {user.role === "admin" ? (
              <Link
                href="/equipo"
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 leading-[2.75rem] text-ink/60"
              >
                Tablero
              </Link>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5">
        {offline ? (
          <p className="u-mono mb-4 rounded-2xl border-[1.5px] border-mango-deep bg-mango/10 px-4 py-3 text-mango-deep">
            Sin conexión. Se vuelve a intentar solo.
          </p>
        ) : null}
        {error ? (
          <p className="u-mono mb-4 text-mango-deep" role="alert">
            {error}
          </p>
        ) : null}

        <Section
          title="En camino"
          count={enCamino.length}
          tone="#8FD14F"
          empty="Nada en la calle ahora."
        >
          {enCamino.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              now={now}
              store={stores.find((s) => s.id === o.storeId)?.name}
              sizes={sizes}
              city={brand.city}
              busy={busy === o.id}
              actions={[
                {
                  label: "Entregado ✓",
                  primary: true,
                  onClick: () => run(o.id, () => completeDelivery(o.id)),
                },
              ]}
            />
          ))}
        </Section>

        <Section
          title="Mis entregas"
          count={saliendo.length}
          tone="#FF6A1A"
          empty="No tienes domicilios asignados. Abajo están los que nadie ha tomado."
        >
          {saliendo.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              now={now}
              store={stores.find((s) => s.id === o.storeId)?.name}
              sizes={sizes}
              city={brand.city}
              busy={busy === o.id}
              actions={
                o.status === "listo"
                  ? [
                      {
                        label: "Salí con el pedido",
                        primary: true,
                        onClick: () => run(o.id, () => startDelivery(o.id)),
                      },
                      { label: "No puedo", onClick: () => run(o.id, () => releaseDelivery(o.id)) },
                    ]
                  : [{ label: "No puedo", onClick: () => run(o.id, () => releaseDelivery(o.id)) }]
              }
              waiting={o.status !== "listo" ? "La barra todavía lo está preparando" : undefined}
            />
          ))}
        </Section>

        <Section
          title="Disponibles"
          count={board.available.length}
          tone="#7B3FF2"
          empty="No hay domicilios listos sin repartidor."
        >
          {board.available.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              now={now}
              store={stores.find((s) => s.id === o.storeId)?.name}
              sizes={sizes}
              city={brand.city}
              busy={busy === o.id}
              compact
              actions={[
                { label: "Tomar", primary: true, onClick: () => run(o.id, () => takeDelivery(o.id)) },
              ]}
            />
          ))}
        </Section>

        <section className="mt-8 border-t-[1.5px] border-ink/15 pt-6">
          <div className="flex items-baseline gap-3">
            <h2 className="u-display text-2xl">Entregados hoy</h2>
            <span className="u-mono text-ink/45">{board.doneToday.length}</span>
          </div>
          {board.doneToday.length === 0 ? (
            <p className="u-mono mt-3 normal-case tracking-[0.01em] text-ink/40">
              Todavía ninguno.
            </p>
          ) : (
            <ul className="mt-3 grid gap-1.5">
              {board.doneToday.map((o) => (
                <li
                  key={o.id}
                  className="u-mono flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-ink/10 bg-white px-3.5 py-2.5 normal-case tracking-[0.01em] text-ink/60"
                >
                  <span className="truncate">
                    {o.id} · {o.customer.name}
                  </span>
                  <span className="shrink-0">{formatClock(o.statusAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string;
  count: number;
  tone: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="flex items-center gap-2.5">
        <span className="h-3 w-3 rounded-full" style={{ background: tone }} aria-hidden="true" />
        <h2 className="u-display text-2xl">{title}</h2>
        <span className="u-mono text-ink/45">{count}</span>
      </div>
      {count === 0 ? (
        <p className="u-mono mt-3 rounded-2xl border-[1.5px] border-dashed border-ink/15 px-4 py-5 text-center normal-case tracking-[0.01em] text-ink/40">
          {empty}
        </p>
      ) : (
        <div className="mt-3 grid gap-3">{children}</div>
      )}
    </section>
  );
}

function DeliveryCard({
  order,
  now,
  store,
  sizes,
  city,
  busy,
  actions,
  compact,
  waiting,
}: {
  order: Order;
  now: number;
  store?: string;
  sizes: Size[];
  city: string;
  busy: boolean;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
  /** En «disponibles» se enseña menos: aún no es suyo. */
  compact?: boolean;
  waiting?: string;
}) {
  const address = order.customer.address ?? "";
  const phone = order.customer.phone.replace(/\s/g, "");
  const alerts = alertsOf(order);
  const mins = elapsedMinutes(order.outAt ?? order.statusAt, now);
  const pagado = order.payment !== "pendiente";
  // Dirección + ciudad: Google Maps la resuelve mejor con la ciudad puesta.
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${city}`)}`;

  return (
    <article className="rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="u-mono text-base tracking-[0.08em]">{order.id}</p>
          <p className="u-mono mt-0.5 text-ink/40">
            {formatClock(order.createdAt)}
            {store ? ` · sale de ${store}` : ""}
          </p>
        </div>
        <span
          className={`u-mono shrink-0 rounded-full border-[1.5px] px-3 py-1 ${
            pagado
              ? "border-matcha-deep/40 bg-matcha/20 text-matcha-deep"
              : "border-mango-deep bg-mango/10 text-mango-deep"
          }`}
        >
          {pagado ? "Pagado" : `Cobrar ${money(order.total)}`}
        </span>
      </header>

      <p className="mt-3 text-xl font-semibold leading-tight">{order.customer.name}</p>
      <p className="mt-1 text-lg leading-snug text-ink/80">{address}</p>

      {alerts.length > 0 ? (
        <ul className="mt-2 grid gap-1.5">
          {alerts.map((a, i) => (
            <li
              key={i}
              className="u-mono rounded-xl border-[1.5px] border-mango-deep bg-mango/10 px-3 py-2 normal-case tracking-[0.01em] text-mango-deep"
            >
              ! {a}
            </li>
          ))}
        </ul>
      ) : order.customer.notes ? (
        <p className="u-mono mt-2 normal-case tracking-[0.01em] text-ink/55">
          {order.customer.notes}
        </p>
      ) : null}

      {!compact ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={maps}
              target="_blank"
              rel="noopener"
              className="u-mono grid min-h-12 place-items-center rounded-full border-[1.5px] border-ink bg-paper text-ink"
            >
              📍 Mapa
            </a>
            <a
              href={`tel:${phone}`}
              className="u-mono grid min-h-12 place-items-center rounded-full border-[1.5px] border-ink bg-paper text-ink"
            >
              📞 Llamar
            </a>
          </div>

          <ul className="mt-3 grid gap-1 border-t-[1.5px] border-ink/10 pt-3">
            {order.lines.map((l) => {
              const detail = describe(l, sizes);
              return (
                <li key={l.key} className="text-[0.95rem] leading-snug">
                  <span className="font-medium">
                    {l.qty}× {l.name}
                  </span>
                  {detail ? <span className="text-ink/50"> · {detail}</span> : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="u-mono mt-2 text-ink/45">
          {order.lines.reduce((n, l) => n + l.qty, 0)} bebidas · {money(order.total)}
        </p>
      )}

      {waiting ? <p className="u-mono mt-3 text-ink/45">{waiting}</p> : null}
      {order.outAt ? (
        <p className="u-mono mt-3 text-ink/45">
          Saliste hace {mins < 1 ? "un momento" : `${mins} min`}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={busy}
            onClick={a.onClick}
            className={
              a.primary
                ? "btn btn-mango min-w-0 flex-1 py-4 text-base disabled:opacity-50"
                : "u-mono min-h-12 shrink-0 rounded-full border-[1.5px] border-ink/20 px-4 text-ink/60 disabled:opacity-50"
            }
          >
            {a.label}
          </button>
        ))}
      </div>
    </article>
  );
}

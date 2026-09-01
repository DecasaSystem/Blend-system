"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Logo from "../Logo";
import OrderCard from "./OrderCard";
import ContentEditor from "./editor/ContentEditor";
import StatsPanel from "./stats/StatsPanel";
import {
  askForNotifications,
  chime,
  useMediaQuery,
  useNewOrderAlert,
  useNow,
  useOrders,
} from "./useOrders";
import { money } from "@/lib/cart";
import {
  demoOrder,
  STATUSES,
  STATUS_COLOR,
  STATUS_LABEL,
  type BoardStatus,
  type Order,
} from "@/lib/orders";
import { clearAllOrders, placeOrder, updateOrderStatus } from "@/actions/orders";
import { signOut } from "@/actions/auth";
import type { SessionUser } from "@/lib/session";
import { useSite } from "../SiteProvider";

const SOUND_KEY = "blend.team.sound";

export default function OrderBoard({
  user,
  initialOrders,
}: {
  user: SessionUser;
  initialOrders: Order[];
}) {
  const site = useSite();
  const { orders, offline, refresh } = useOrders(initialOrders);
  const now = useNow();
  const [sound, setSound] = useState(false);
  const [tab, setTab] = useState<BoardStatus>("nuevo");
  const [view, setView] = useState<"pedidos" | "metricas" | "contenido">("pedidos");
  const arrived = useNewOrderAlert(orders, sound);
  const wide = useMediaQuery("(min-width: 1024px)");

  /** Mover un pedido: se pide al servidor y se recarga la lista. */
  const move = async (id: string, status: BoardStatus) => {
    await updateOrderStatus(id, status);
    await refresh();
  };

  useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const byStatus = useMemo(() => {
    const map: Record<BoardStatus, Order[]> = {
      nuevo: [],
      preparando: [],
      listo: [],
      entregado: [],
    };
    // El más viejo primero: se atiende por orden de llegada.
    // Los que esperan pago no llegan aquí, pero por si acaso se ignoran.
    [...orders]
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((o) => {
        if (o.status !== "pago") map[o.status].push(o);
      });
    return map;
  }, [orders]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const list = orders.filter((o) => o.createdAt >= start.getTime());
    // "Ventas" cuenta lo que ya se empezó a preparar; el promedio divide por
    // ese mismo conjunto, no por todos los pedidos.
    const confirmed = list.filter((o) => o.status !== "nuevo");
    const sales = confirmed.reduce((n, o) => n + o.total, 0);
    return {
      count: list.length,
      sales,
      average: confirmed.length ? Math.round(sales / confirmed.length) : 0,
      open: list.filter((o) => o.status !== "entregado").length,
    };
  }, [orders]);

  const toggleSound = async () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* almacenamiento no disponible */
    }
    if (next) {
      // Sonar aquí sirve de prueba y desbloquea el audio del navegador.
      chime();
      await askForNotifications();
    }
  };

  return (
    <main className="min-h-svh bg-paper-2">
      {/* Barra de la vista de equipo */}
      <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <Logo size={30} />
            <span className="u-display text-2xl">BLEND</span>
          </Link>
          {/* Las tres partes de la vista de equipo */}
          <div
            className="flex items-center gap-1 rounded-full border-[1.5px] border-ink p-1"
            role="tablist"
          >
            {(
              [
                { id: "pedidos", label: "Pedidos" },
                { id: "metricas", label: "Métricas" },
                { id: "contenido", label: "Contenido" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={`u-mono min-h-9 rounded-full px-3.5 transition-colors ${
                  view === v.id ? "bg-ink text-paper" : "text-ink/55"
                }`}
              >
                {v.label}
                {v.id === "pedidos" && today.open > 0 ? (
                  <span className="ml-1.5 opacity-60">{today.open}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {view === "pedidos" ? (
              <>
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={sound}
                  className={`u-mono flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-3.5 transition-colors ${
                    sound ? "border-ink bg-ink text-paper" : "border-ink/25 text-ink/60"
                  }`}
                >
                  <span aria-hidden="true">{sound ? "♪" : "✕"}</span>
                  Aviso
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await placeOrder(demoOrder(site.products, site.stores));
                      if ("error" in res) alert(res.error);
                      await refresh();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "No se pudo crear el pedido.");
                    }
                  }}
                  className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
                >
                  Pedido de prueba
                </button>
              </>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                title={`${user.name} · ${user.email}`}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {view === "metricas" ? (
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <StatsPanel />
        </div>
      ) : view === "contenido" ? (
        // Más angosto que el tablero: un formulario de 1600 px no se lee.
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ContentEditor />
        </div>
      ) : (
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          {/* Métricas del día */}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Pedidos hoy" value={String(today.count)} />
            <Metric label="Sin entregar" value={String(today.open)} tone="#FF6A1A" />
            <Metric label="Ventas del día" value={money(today.sales)} />
            <Metric label="Ticket promedio" value={money(today.average)} />
          </dl>

          {/* En móvil: una columna a la vez */}
          {wide ? null : (
            <div className="mt-6">
              <div className="rail -mx-4 px-4 pb-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTab(s)}
                    aria-pressed={tab === s}
                    className={`u-mono flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-4 transition-colors ${
                      tab === s
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/20 bg-white text-ink/65"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_COLOR[s] }}
                      aria-hidden="true"
                    />
                    {STATUS_LABEL[s]}
                    <span className="opacity-50">{byStatus[s].length}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                {byStatus[tab].length === 0 ? (
                  <Empty status={tab} offline={offline} />
                ) : (
                  byStatus[tab].map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      now={now}
                      fresh={arrived?.id === o.id}
                      onMove={move}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* En escritorio: las cuatro columnas */}
          {wide ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-4">
              {STATUSES.map((s) => (
                <section key={s} className="min-w-0">
                  <div className="flex items-center gap-2 pb-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: STATUS_COLOR[s] }}
                      aria-hidden="true"
                    />
                    <h2 className="u-display text-2xl">{STATUS_LABEL[s]}</h2>
                    <span className="u-mono ml-auto text-ink/40">{byStatus[s].length}</span>
                  </div>
                  <div
                    className="grid gap-3 rounded-[26px] border-[1.5px] border-dashed border-ink/15 p-3"
                    style={{ minHeight: "12rem" }}
                  >
                    {byStatus[s].length === 0 ? (
                      <Empty status={s} offline={offline} />
                    ) : (
                      byStatus[s].map((o) => (
                        <OrderCard
                          key={o.id}
                          order={o}
                          now={now}
                          fresh={arrived?.id === o.id}
                          onMove={move}
                        />
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {orders.length > 0 ? (
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("¿Borrar todos los pedidos guardados?")) return;
                  const res = await clearAllOrders();
                  if ("error" in res) alert(res.error);
                  await refresh();
                }}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/40 transition-colors hover:border-mango-deep hover:text-mango-deep"
              >
                Borrar historial
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Aviso en pantalla, además del sonido */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-300 ${
          arrived ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
        aria-live="polite"
      >
        <p className="u-mono rounded-full border-[1.5px] border-ink bg-mango px-5 py-3 text-white shadow-[0_10px_30px_rgba(27,11,46,0.35)]">
          Pedido {arrived?.id} · {arrived?.customer.name}
        </p>
      </div>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-ink/15 bg-white p-3.5">
      <dt className="u-mono text-ink/40">{label}</dt>
      <dd className="u-display mt-1 text-3xl" style={tone ? { color: tone } : undefined}>
        {value}
      </dd>
    </div>
  );
}

function Empty({ status, offline }: { status: BoardStatus; offline: boolean }) {
  const copy: Record<BoardStatus, string> = {
    nuevo: "Nada esperando. Los pedidos entran solos.",
    preparando: "Ninguno en la licuadora.",
    listo: "Nada esperando en la barra.",
    entregado: "Todavía no sale nada hoy.",
  };
  return (
    <p className="u-mono grid place-items-center px-3 py-8 text-center normal-case tracking-[0.01em] text-ink/35">
      {offline ? "Sin conexión con el servidor" : copy[status]}
    </p>
  );
}

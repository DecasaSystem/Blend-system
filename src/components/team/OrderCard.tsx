"use client";

import { describe, money } from "@/lib/cart";
import {
  alertsOf,
  elapsedMinutes,
  formatClock,
  LATE_AFTER,
  nextStatus,
  prevStatus,
  STATUS_ACTION,
  STATUS_COLOR,
  STATUS_LABEL,
  type BoardStatus,
  type Order,
} from "@/lib/orders";
import { useSite } from "../SiteProvider";

/** Corto a propósito: en la ficha compite con el total. */
const PAYMENT_LABEL: Record<Order["payment"], string> = {
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  pendiente: "Sin pagar",
};

const METHOD_LABEL: Record<NonNullable<Order["paymentMethod"]>, string> = {
  tarjeta: "💳 Tarjeta",
  efectivo: "💵 Efectivo",
  transferencia: "📱 Transferencia",
};

export default function OrderCard({
  order,
  now,
  fresh,
  onMove,
}: {
  order: Order;
  now: number;
  /** Recién llegado: se resalta unos segundos. */
  fresh?: boolean;
  onMove: (id: string, status: BoardStatus) => void;
}) {
  const { stores, sizes } = useSite();
  const store = stores.find((s) => s.id === order.storeId);
  const mins = elapsedMinutes(order.statusAt, now);
  const late = mins >= LATE_AFTER[order.status];
  const alerts = alertsOf(order);
  const next = nextStatus(order.status);
  const back = prevStatus(order.status);
  const action = STATUS_ACTION[order.status];
  const items = order.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <article
      className={`rounded-[22px] border-[1.5px] bg-white p-4 transition-shadow ${
        fresh ? "border-mango shadow-[0_0_0_4px_rgba(255,106,26,0.22)]" : "border-ink/15"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="u-mono text-base tracking-[0.08em] text-ink">{order.id}</p>
          <p className="u-mono mt-0.5 text-ink/40">
            {formatClock(order.createdAt)} · {order.channel === "web" ? "En línea" : "Mostrador"}
          </p>
        </div>
        <div className="text-right">
          <p
            className="u-mono text-base tracking-[0.06em]"
            style={{ color: late ? "#D84A00" : "rgba(27,11,46,0.45)" }}
          >
            {mins < 1 ? "ahora" : `${mins} min`}
          </p>
          {late ? <p className="u-mono text-mango-deep">Se está pasando</p> : null}
        </div>
      </header>

      {alerts.length > 0 ? (
        <ul className="mt-3 grid gap-1.5">
          {alerts.map((a, i) => (
            <li
              key={i}
              className="u-mono flex items-start gap-2 rounded-xl border-[1.5px] border-mango-deep bg-mango/10 px-3 py-2 normal-case tracking-[0.01em] text-mango-deep"
            >
              <span aria-hidden="true">!</span>
              {a}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Entrega */}
      <div className="mt-3 rounded-2xl bg-paper p-3">
        <p className="u-mono text-ink/45">
          {order.mode === "envio" ? "Domicilio" : `Recoge en ${store?.area ?? "tienda"}`}
        </p>
        <p className="mt-1 font-medium leading-tight">{order.customer.name}</p>
        {order.mode === "envio" && order.customer.address ? (
          <p className="mt-1 text-[0.95rem] leading-snug text-ink/70">{order.customer.address}</p>
        ) : (
          <p className="mt-1 text-[0.95rem] leading-snug text-ink/70">{store?.address}</p>
        )}
        <a
          href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
          className="u-mono mt-1.5 inline-block text-ube underline-offset-4 hover:underline"
        >
          {order.customer.phone}
        </a>
        {order.customer.notes && alerts.length === 0 ? (
          <p className="u-mono mt-2 normal-case tracking-[0.01em] text-ink/55">
            {order.customer.notes}
          </p>
        ) : null}
      </div>

      {/* Qué preparar */}
      <ul className="mt-3 grid gap-2">
        {order.lines.map((l) => {
          const detail = describe(l, sizes);
          return (
            <li key={l.key} className="flex gap-2.5">
              <span
                className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-[0.7rem] font-semibold"
                style={{ background: l.color, color: "#fff" }}
                aria-hidden="true"
              >
                {l.qty}
              </span>
              <div className="min-w-0">
                <p className="font-medium leading-tight">
                  {l.name}
                  {l.offerLabel ? (
                    <span className="u-mono ml-2 text-matcha-deep">{l.offerLabel}</span>
                  ) : null}
                </p>
                {detail ? (
                  <p className="u-mono mt-0.5 text-[0.75rem] normal-case tracking-[0.01em] text-ink/50">
                    {detail}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 border-t-[1.5px] border-ink/10 pt-3">
        <p className="u-mono min-w-0 text-ink/45">
          {items} {items === 1 ? "bebida" : "bebidas"} ·{" "}
          {order.paymentMethod
            ? METHOD_LABEL[order.paymentMethod]
            : order.payment === "pendiente"
              ? "Sin pagar"
              : PAYMENT_LABEL[order.payment]}
        </p>
        <p className="u-mono shrink-0 text-base text-ink">{money(order.total)}</p>
      </div>

      {(action && next) || back ? (
        <div className="mt-3 flex items-center gap-2">
          {back ? (
            <button
              type="button"
              onClick={() => onMove(order.id, back)}
              className="u-mono grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20 text-ink/50 transition-colors hover:border-ink hover:text-ink"
              aria-label={`Devolver a ${STATUS_LABEL[back]}`}
              title={`Devolver a ${STATUS_LABEL[back]}`}
            >
              ←
            </button>
          ) : null}
          {action && next ? (
            <button
              type="button"
              onClick={() => onMove(order.id, next)}
              className="btn btn-sm min-w-0 flex-1 text-white"
              style={{ background: STATUS_COLOR[order.status] }}
            >
              {action}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

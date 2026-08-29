"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountShell from "./AccountShell";
import { addAddress, removeAddress, signOut, type AccountState } from "@/actions/account";
import { describe, money } from "@/lib/cart";
import { STATUS_COLOR, STATUS_LABEL, formatClock, type Order } from "@/lib/orders";
import { useSite } from "../SiteProvider";
import type { Customer } from "@/lib/customer-session";

type Address = {
  id: string;
  label: string;
  address: string;
  notes: string | null;
};

export default function AccountPanel({
  customer,
  orders,
  addresses,
  stamps,
}: {
  customer: Customer;
  orders: Order[];
  addresses: Address[];
  stamps: { delivered: number; toward: number };
}) {
  const { stores, rewards } = useSite();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [state, action] = useActionState<AccountState, FormData>(async (prev, data) => {
    const res = await addAddress(prev, data);
    if (!res.error) setAdding(false);
    return res;
  }, {});
  const [, startTransition] = useTransition();

  const goal = Math.max(2, rewards.stamps);
  const colors = ["#FF6A1A", "#7B3FF2", "#8FD14F", "#FFD166", "#F2557A", "#6FA82E"];

  return (
    <AccountShell
      eyebrow="Tu cuenta"
      title="Hola,"
      accent={customer.name.split(" ")[0]}
      lead={customer.email}
      wide
    >
      {/* Sellos */}
      <section className="card-ink mt-8 p-6 hover:translate-x-0 hover:translate-y-0 hover:shadow-[4px_5px_0_0_var(--color-ink)]">
        <p className="u-mono text-ink/45">{rewards.eyebrow}</p>
        <h2 className="u-display mt-1 text-3xl">
          {stamps.toward === 0
            ? "Tu primer pedido suma sello"
            : stamps.toward === goal - 1
              ? "El próximo va por la casa"
              : `Te faltan ${goal - stamps.toward} para el gratis`}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {Array.from({ length: goal }, (_, i) => {
            const filled = i < stamps.toward;
            return (
              <span
                key={i}
                className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink"
                style={{ background: filled ? colors[i % colors.length] : "transparent" }}
                aria-hidden="true"
              >
                <span
                  className="u-mono text-[0.6rem]"
                  style={{ color: filled ? "#fff" : "rgba(27,11,46,.35)" }}
                >
                  {i === goal - 1 ? "★" : i + 1}
                </span>
              </span>
            );
          })}
        </div>
        <p className="u-mono mt-3 text-ink/40">
          {stamps.delivered} {stamps.delivered === 1 ? "pedido entregado" : "pedidos entregados"} en
          total
        </p>
      </section>

      {/* Pedidos */}
      <section className="mt-10">
        <h2 className="u-display text-4xl">Tus pedidos</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-ink/60">
            Todavía no has pedido nada.{" "}
            <Link href="/#menu" className="font-medium text-ube underline-offset-4 hover:underline">
              Mira el menú
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.map((o) => {
              const store = stores.find((s) => s.id === o.storeId);
              return (
                <li key={o.id} className="rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="u-mono text-base tracking-[0.08em]">{o.id}</p>
                    <span
                      className="u-mono rounded-full px-2.5 py-1 text-[0.58rem] text-white"
                      style={{ background: STATUS_COLOR[o.status] }}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <p className="u-mono mt-1 text-ink/40">
                    {new Date(o.createdAt).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {formatClock(o.createdAt)} ·{" "}
                    {o.mode === "envio" ? "A domicilio" : `Recogido en ${store?.area ?? "tienda"}`}
                  </p>

                  <ul className="mt-3 grid gap-1.5">
                    {o.lines.map((l) => (
                      <li key={l.key} className="flex gap-2.5">
                        <span
                          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-ink text-[0.62rem] font-semibold text-white"
                          style={{ background: l.color }}
                          aria-hidden="true"
                        >
                          {l.qty}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium">{l.name}</span>
                          {describe(l) ? (
                            <span className="u-mono ml-2 text-[0.72rem] normal-case tracking-[0.01em] text-ink/45">
                              {describe(l)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="u-mono mt-3 border-t-[1.5px] border-ink/10 pt-3 text-base">
                    {money(o.total)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Direcciones */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="u-display text-4xl">Tus direcciones</h2>
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
            >
              + Añadir
            </button>
          ) : null}
        </div>

        {adding ? (
          <form
            action={action}
            className="card-ink mt-4 grid gap-3 p-5 hover:translate-x-0 hover:translate-y-0 hover:shadow-[4px_5px_0_0_var(--color-ink)]"
          >
            <label className="block">
              <span className="u-mono mb-2 block text-ink/45">Nombre</span>
              <input name="label" placeholder="Casa, oficina…" required className="input" />
            </label>
            <label className="block">
              <span className="u-mono mb-2 block text-ink/45">Dirección</span>
              <input
                name="address"
                placeholder="Cra. 14 #12-40, apto 302"
                required
                className="input"
              />
            </label>
            <label className="block">
              <span className="u-mono mb-2 block text-ink/45">Indicaciones</span>
              <input name="notes" placeholder="Portería, timbre 2…" className="input" />
            </label>
            {state.error ? (
              <p className="u-mono text-mango-deep" role="alert">
                {state.error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-sm btn-mango flex-1">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {addresses.length === 0 && !adding ? (
          <p className="mt-3 text-ink/60">Guarda una y no vuelves a escribirla al pedir.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-2xl border-[1.5px] border-ink/15 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.label}</p>
                  <p className="mt-0.5 text-ink/65">{a.address}</p>
                  {a.notes ? <p className="u-mono mt-1 text-ink/40">{a.notes}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await removeAddress(a.id);
                      router.refresh();
                    })
                  }
                  className="u-mono min-h-11 shrink-0 rounded-full border-[1.5px] border-ink/20 px-3 text-ink/45 transition-colors hover:border-mango-deep hover:text-mango-deep"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rule my-8" />

      <div className="flex flex-wrap gap-3">
        <Link href="/#menu" className="btn btn-mango">
          Pedir algo
        </Link>
        <form action={signOut}>
          <button type="submit" className="btn btn-paper">
            Cerrar sesión
          </button>
        </form>
      </div>
    </AccountShell>
  );
}

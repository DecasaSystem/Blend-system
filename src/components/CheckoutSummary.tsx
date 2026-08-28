"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { useCart } from "./CartProvider";
import { describe, money, MAX_QTY } from "@/lib/cart";
import { createOrder } from "@/lib/orders";
import { useSite } from "./SiteProvider";

/**
 * Resumen y envío del pedido a la barra.
 * El pago con tarjeta entra en la fase 6; por ahora el pedido sale marcado
 * como "pago pendiente" y aparece igual en /equipo.
 */
export default function CheckoutSummary() {
  const {
    lines,
    setQty,
    remove,
    clear,
    subtotal,
    delivery,
    total,
    count,
    mode,
    setMode,
    storeId,
    setStoreId,
    freeDelivery,
    missingForFree,
  } = useCart();
  const { stores } = useSite();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState<{ id: string; mode: string } | null>(null);

  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const order = createOrder({
      lines,
      mode,
      storeId,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        address: mode === "envio" ? address.trim() : undefined,
        notes: notes.trim() || undefined,
      },
      payment: "pendiente",
      channel: "web",
    });
    setSent({ id: order.id, mode });
    clear();
  };

  if (sent) {
    return (
      <main className="min-h-svh bg-paper">
        <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5 py-16 text-center">
          <div className="mx-auto flex" aria-hidden="true">
            <span
              className="h-16 w-16 rounded-full bg-mango"
              style={{ mixBlendMode: "multiply" }}
            />
            <span
              className="-ml-6 h-16 w-16 rounded-full bg-ube"
              style={{ mixBlendMode: "multiply" }}
            />
            <span
              className="-ml-6 h-16 w-16 rounded-full bg-matcha"
              style={{ mixBlendMode: "multiply" }}
            />
          </div>

          <h1 className="u-display mt-8 text-[clamp(2.4rem,9vw,4rem)]">
            La barra ya lo <span className="u-italic text-mango">tiene</span>
          </h1>
          <p className="u-mono mt-5 text-base tracking-[0.1em]">{sent.id}</p>
          <p className="mt-4 leading-relaxed text-ink/65">
            {sent.mode === "envio"
              ? "Te llamamos cuando el domiciliario salga. Veinticinco minutos desde ahora."
              : `Te avisamos cuando esté listo para recoger en ${store.name}.`}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-mango">
              Volver al menú
            </Link>
            <Link href="/equipo" className="btn btn-paper">
              Ver la barra
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex min-h-11 items-center gap-3" aria-label="BLEND, inicio">
            <Logo size={34} />
            <span className="u-display text-3xl">BLEND</span>
          </Link>
          <span className="u-mono ml-auto text-ink/40">Tu pedido</span>
        </div>

        {count === 0 ? (
          <div className="mt-16 text-center">
            <h1 className="u-display text-[clamp(2.4rem,7vw,4rem)]">
              No hay nada <span className="u-italic text-ube">que pagar</span>
            </h1>
            <p className="mt-4 text-ink/62">Vuelve al menú y arma tu pedido.</p>
            <Link href="/" className="btn btn-mango mt-8">
              Ver el menú
            </Link>
          </div>
        ) : (
          <>
            <h1 className="u-display mt-8 text-[clamp(2.4rem,7vw,4rem)]">
              Revisa antes de <span className="u-italic text-mango">pagar</span>
            </h1>

            <div className="mt-8 grid gap-2 rounded-[26px] border-[1.5px] border-ink bg-white p-2">
              <div className="grid grid-cols-2 gap-1 rounded-full border-[1.5px] border-ink p-1">
                {(
                  [
                    { id: "envio", label: "A domicilio" },
                    { id: "recoger", label: "Recoger" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                    className={`u-mono min-h-11 rounded-full transition-colors ${
                      mode === m.id ? "bg-ink text-paper" : "text-ink/55"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {mode === "recoger" ? (
                <div className="p-3">
                  <label className="u-mono mb-2 block text-ink/45" htmlFor="checkout-store">
                    Recoges en
                  </label>
                  <select
                    id="checkout-store"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full appearance-none rounded-2xl border-[1.5px] border-ink/20 bg-white px-4 py-3 text-base outline-none focus:border-ink"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.address}
                      </option>
                    ))}
                  </select>
                  <p className="u-mono mt-2 text-ink/40">
                    {store.hours} · {store.phone}
                  </p>
                </div>
              ) : null}
            </div>

            <ul className="mt-6 divide-y-[1.5px] divide-ink/10 border-y-[1.5px] border-ink/10">
              {lines.map((l) => {
                const detail = describe(l);
                const cap = Math.min(l.maxQty ?? MAX_QTY, MAX_QTY);
                return (
                  <li key={l.key} className="flex gap-4 py-4">
                    <span
                      className="mt-1 h-12 w-12 shrink-0 rounded-full border-[1.5px] border-ink"
                      style={{ background: l.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-medium leading-tight">{l.name}</p>
                        <p className="u-mono shrink-0 text-base">{money(l.unitPrice * l.qty)}</p>
                      </div>
                      {l.offerLabel ? (
                        <p className="u-mono mt-1 text-matcha-deep">{l.offerLabel}</p>
                      ) : null}
                      {detail ? (
                        <p className="u-mono mt-1 text-[0.78rem] normal-case tracking-[0.01em] text-ink/45">
                          {detail}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center rounded-full border-[1.5px] border-ink/20">
                          <button
                            type="button"
                            onClick={() => setQty(l.key, l.qty - 1)}
                            className="grid h-10 w-10 place-items-center rounded-full"
                            aria-label={`Quitar uno de ${l.name}`}
                          >
                            −
                          </button>
                          <span className="u-mono w-6 text-center">{l.qty}</span>
                          <button
                            type="button"
                            disabled={l.qty >= cap}
                            onClick={() => setQty(l.key, l.qty + 1)}
                            className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30"
                            aria-label={`Agregar uno de ${l.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(l.key)}
                          className="u-mono text-ink/40 underline-offset-4 hover:text-ink hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <dl className="u-mono mt-6 grid gap-2 text-ink/60">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{mode === "envio" ? "Domicilio" : "Recoger en tienda"}</dt>
                <dd>{delivery === 0 ? "Gratis" : money(delivery)}</dd>
              </div>
              {mode === "envio" && !freeDelivery ? (
                <div className="flex justify-between text-ink/40">
                  <dt>Faltan para domicilio gratis</dt>
                  <dd>{money(missingForFree)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 flex items-end justify-between border-t-[1.5px] border-ink pt-4">
              <span className="u-mono text-ink/50">Total</span>
              <span className="u-display text-5xl">{money(total)}</span>
            </div>

            {/* Datos que la barra necesita para preparar y entregar */}
            <form onSubmit={submit} className="mt-10">
              <h2 className="u-display text-4xl">
                {mode === "envio" ? "¿Dónde te lo dejamos?" : "¿A nombre de quién?"}
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" id="nombre">
                  <input
                    id="nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Camila Ruiz"
                    className="input"
                  />
                </Field>
                <Field label="Teléfono" id="telefono">
                  <input
                    id="telefono"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    minLength={7}
                    autoComplete="tel"
                    placeholder="310 123 4567"
                    className="input"
                  />
                </Field>
              </div>

              {mode === "envio" ? (
                <div className="mt-4">
                  <Field label="Dirección" id="direccion">
                    <input
                      id="direccion"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      autoComplete="street-address"
                      placeholder="Calle 70 #11-32, apto 402"
                      className="input"
                    />
                  </Field>
                </div>
              ) : null}

              <div className="mt-4">
                <Field label="Algo más que debamos saber" id="notas">
                  <textarea
                    id="notas"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    maxLength={200}
                    placeholder="Alergias, cómo llegar, a qué hora lo necesitas…"
                    className="input resize-none rounded-2xl"
                  />
                </Field>
              </div>

              <button type="submit" className="btn btn-mango mt-6 w-full sm:w-auto">
                Enviar el pedido · {money(total)}
              </button>

              <p className="u-mono mt-3 text-ink/40">
                El pago con tarjeta entra en la fase 6. Por ahora el pedido llega a la barra marcado
                como pago pendiente.
              </p>
            </form>

            <Link href="/" className="btn btn-paper mt-8">
              ← Seguir pidiendo
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="u-mono mb-2 block text-ink/45" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

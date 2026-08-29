"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { useCart } from "./CartProvider";
import { describe, money, MAX_QTY } from "@/lib/cart";
import { placeOrder } from "@/actions/orders";
import { payWithCard } from "@/actions/checkout";
import { useSite } from "./SiteProvider";

/**
 * Resumen y envío del pedido a la barra.
 * El pago con tarjeta entra en la fase 6; por ahora el pedido sale marcado
 * como "pago pendiente" y aparece igual en /equipo.
 */
type SavedAddress = { id: string; label: string; address: string };

export default function CheckoutSummary({
  customer,
  addresses = [],
  cardPayments = false,
  cancelled = false,
}: {
  customer?: { name: string; email: string; phone: string | null } | null;
  addresses?: SavedAddress[];
  /** Falso si no hay pasarela configurada: entonces sólo se cobra al recibir. */
  cardPayments?: boolean;
  cancelled?: boolean;
}) {
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

  // Con cuenta, los datos vienen puestos: nadie debería reescribir su nombre
  // y su teléfono en cada pedido.
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(addresses[0]?.address ?? "");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState<{ id: string; mode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"tarjeta" | "recibir">(cardPayments ? "tarjeta" : "recibir");
  const [pending, startTransition] = useTransition();

  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const order = {
      lines,
      mode,
      storeId,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        address: mode === "envio" ? address.trim() : undefined,
        notes: notes.trim() || undefined,
      },
      channel: "web" as const,
    };

    startTransition(async () => {
      if (cardPayments && method === "tarjeta") {
        const res = await payWithCard(order);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        // El carrito se vacía al volver de la pasarela, no antes: si el pago
        // se cancela, el pedido sigue ahí.
        window.location.href = res.url;
        return;
      }

      const res = await placeOrder({ ...order, payment: "pendiente" });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSent({ id: res.id, mode });
      clear();
    });
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
            <Link href={customer ? "/cuenta" : "/cuenta/registro"} className="btn btn-paper">
              {customer ? "Ver mis pedidos" : "Crear una cuenta"}
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

            {cancelled ? (
              <p className="u-mono mt-4 rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 normal-case tracking-[0.01em] text-ink/60">
                No se cobró nada. Tu pedido sigue aquí por si quieres intentarlo otra vez.
              </p>
            ) : null}

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

              {!customer ? (
                <p className="u-mono mt-3 normal-case tracking-[0.01em] text-ink/45">
                  Puedes pedir así, sin cuenta.{" "}
                  <Link href="/cuenta/entrar" className="text-ube underline underline-offset-4">
                    O entra a la tuya
                  </Link>{" "}
                  para guardar direcciones y acumular sellos.
                </p>
              ) : null}

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

              {mode === "envio" && addresses.length > 0 ? (
                <div className="mt-4">
                  <p className="u-mono mb-2 text-ink/45">Tus direcciones</p>
                  <div className="rail">
                    {addresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAddress(a.address)}
                        aria-pressed={address === a.address}
                        className={`u-mono min-h-11 whitespace-nowrap rounded-full border-[1.5px] px-3.5 transition-colors ${
                          address === a.address
                            ? "border-ink bg-ink text-paper"
                            : "border-ink/20 bg-white text-ink/65 hover:border-ink"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {mode === "envio" ? (
                <div className="mt-4">
                  <Field label="Dirección" id="direccion">
                    <input
                      id="direccion"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      autoComplete="street-address"
                      placeholder="Cra. 14 #12-40, apto 302"
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

              {/* Cómo pagar */}
              {cardPayments ? (
                <div className="mt-8">
                  <p className="u-mono mb-2.5 text-ink/45">Cómo pagas</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        { id: "tarjeta", label: "Con tarjeta ahora", hint: "Pago seguro" },
                        {
                          id: "recibir",
                          label: mode === "envio" ? "Al recibir" : "Al recoger",
                          hint: "Efectivo o datáfono",
                        },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        aria-pressed={method === m.id}
                        className={`min-h-11 rounded-2xl border-[1.5px] px-4 py-3 text-left transition-colors ${
                          method === m.id
                            ? "border-ink bg-ink text-paper"
                            : "border-ink/20 bg-white text-ink hover:border-ink"
                        }`}
                      >
                        <span className="block text-[0.9rem] font-medium">{m.label}</span>
                        <span className="u-mono block opacity-55">{m.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="btn btn-mango mt-6 w-full disabled:opacity-60 sm:w-auto"
              >
                {pending
                  ? "Un momento…"
                  : cardPayments && method === "tarjeta"
                    ? `Pagar ${money(total)}`
                    : `Enviar el pedido · ${money(total)}`}
              </button>

              {error ? (
                <p className="u-mono mt-3 text-mango-deep" role="alert">
                  {error}
                </p>
              ) : null}

              <p className="u-mono mt-3 text-ink/40">
                {cardPayments && method === "tarjeta"
                  ? "Te llevamos a Wompi. La barra ve tu pedido cuando el pago se confirme."
                  : "El pedido llega a la barra marcado como pago pendiente."}
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

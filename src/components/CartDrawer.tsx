"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { describe, money, MAX_QTY } from "@/lib/cart";

export default function CartDrawer() {
  const {
    lines,
    open,
    setOpen,
    setQty,
    remove,
    clear,
    subtotal,
    delivery,
    total,
    count,
    freeDelivery,
    missingForFree,
    mode,
    setMode,
    storeId,
    setStoreId,
    add,
    openSheet,
  } = useCart();
  const { stores, toppings, products, sizes, pricing } = useSite();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  return (
    <div
      className={`fixed inset-0 z-[90] h-[100dvh] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        aria-label="Cerrar carrito"
        className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-[1.5px] border-ink bg-paper transition-transform duration-300 ease-[cubic-bezier(.2,.85,.2,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b-[1.5px] border-ink px-5 py-4">
          <div>
            <p className="u-mono text-ink/45">Tu pedido</p>
            <p className="u-display text-3xl">
              {count} {count === 1 ? "artículo" : "artículos"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lines.length > 0 ? (
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={clear}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-3 text-ink/50 transition-colors hover:border-ink hover:text-ink"
              >
                Vaciar
              </button>
            ) : null}
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink"
              aria-label="Cerrar carrito"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="#1B0B2E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex" aria-hidden="true">
              <span
                className="h-14 w-14 rounded-full bg-mango"
                style={{ mixBlendMode: "multiply" }}
              />
              <span
                className="-ml-5 h-14 w-14 rounded-full bg-ube"
                style={{ mixBlendMode: "multiply" }}
              />
              <span
                className="-ml-5 h-14 w-14 rounded-full bg-matcha"
                style={{ mixBlendMode: "multiply" }}
              />
            </div>
            <p className="u-display text-3xl">Aquí no hay nada todavía</p>
            <p className="text-ink/60">Empieza por los batidos del día o arma el tuyo.</p>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-paper mt-2">
              Ver el menú
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Entrega */}
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
                    tabIndex={open ? 0 : -1}
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                    className={`u-mono min-h-10 rounded-full transition-colors ${
                      mode === m.id ? "bg-ink text-paper" : "text-ink/55"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {mode === "recoger" ? (
                <div className="mt-3">
                  <label className="u-mono mb-2 block text-ink/45" htmlFor="cart-store">
                    Recoges en
                  </label>
                  <select
                    id="cart-store"
                    value={storeId}
                    tabIndex={open ? 0 : -1}
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

              <div className="rule my-4" />

              <ul className="grid gap-3">
                {lines.map((l) => {
                  const detail = describe(l, sizes);
                  const product = products.find((p) => p.id === l.productId);
                  const cap = Math.min(l.maxQty ?? MAX_QTY, MAX_QTY);
                  return (
                    <li
                      key={l.key}
                      className="flex gap-3 rounded-2xl border-[1.5px] border-ink/12 bg-white p-3"
                    >
                      <span
                        className="mt-0.5 h-11 w-11 shrink-0 rounded-full border-[1.5px] border-ink"
                        style={{ background: l.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium leading-tight">{l.name}</p>
                          <p className="u-mono shrink-0">{money(l.unitPrice * l.qty)}</p>
                        </div>

                        {l.offerLabel ? (
                          <p className="u-mono mt-1 text-matcha-deep">
                            {l.offerLabel}
                            {l.listPrice ? (
                              <span className="ml-2 text-ink/35 line-through">
                                {money(l.listPrice)}
                              </span>
                            ) : null}
                          </p>
                        ) : null}

                        {/* Contenido, no etiqueta: sin versalitas ni tracking de label */}
                        {detail ? (
                          <p className="u-mono mt-1 text-[0.78rem] normal-case tracking-[0.01em] text-ink/45">
                            {detail}
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center rounded-full border-[1.5px] border-ink/20">
                            <button
                              type="button"
                              tabIndex={open ? 0 : -1}
                              onClick={() => setQty(l.key, l.qty - 1)}
                              className="grid h-10 w-10 place-items-center rounded-full"
                              aria-label={`Quitar uno de ${l.name}`}
                            >
                              −
                            </button>
                            <span className="u-mono w-6 text-center">{l.qty}</span>
                            <button
                              type="button"
                              tabIndex={open ? 0 : -1}
                              disabled={l.qty >= cap}
                              onClick={() => setQty(l.key, l.qty + 1)}
                              className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30"
                              aria-label={`Agregar uno de ${l.name}`}
                            >
                              +
                            </button>
                          </div>

                          {/* Solo las bebidas del menú tienen opciones que editar */}
                          {product && l.options ? (
                            <button
                              type="button"
                              tabIndex={open ? 0 : -1}
                              onClick={() => {
                                setOpen(false);
                                openSheet(product, { lineKey: l.key });
                              }}
                              className="u-mono text-ink/45 underline-offset-4 hover:text-ink hover:underline"
                            >
                              Editar
                            </button>
                          ) : null}

                          <button
                            type="button"
                            tabIndex={open ? 0 : -1}
                            onClick={() => remove(l.key)}
                            className="u-mono ml-auto text-ink/40 underline-offset-4 hover:text-ink hover:underline"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="u-mono mt-6 text-ink/45">¿Le sumamos algo?</p>
              <div className="rail mt-2 pb-2">
                {toppings.slice(0, 4).map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    tabIndex={open ? 0 : -1}
                    onClick={() =>
                      add({
                        productId: "topping",
                        keySuffix: t.name,
                        name: t.name,
                        basePrice: t.price,
                        color: "#FFD166",
                      })
                    }
                    className="u-mono min-h-11 whitespace-nowrap rounded-full border-[1.5px] border-ink/20 bg-white px-3.5 text-ink/70 transition-colors hover:border-ink hover:text-ink"
                  >
                    + {t.name} · {money(t.price)}
                  </button>
                ))}
              </div>
            </div>

            <footer className="shrink-0 border-t-[1.5px] border-ink bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {mode === "envio" ? (
                freeDelivery ? (
                  <p className="u-mono mb-3 text-matcha-deep">Domicilio gratis aplicado</p>
                ) : (
                  <div className="mb-3">
                    <p className="u-mono mb-1.5 text-ink/50">
                      Te faltan {money(missingForFree)} para el domicilio gratis
                    </p>
                    <div className="h-2 overflow-hidden rounded-full border-[1.5px] border-ink/20">
                      <div
                        className="h-full bg-matcha transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (subtotal / Math.max(1, pricing.delivery.freeFrom)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              ) : (
                <p className="u-mono mb-3 text-ink/50">Recoges en {store.name}</p>
              )}

              <dl className="u-mono grid gap-1.5 text-ink/60">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{money(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{mode === "envio" ? "Domicilio" : "Recoger en tienda"}</dt>
                  <dd>{delivery === 0 ? "Gratis" : money(delivery)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-end justify-between border-t-[1.5px] border-ink/10 pt-3">
                <span className="u-mono text-ink/50">Total</span>
                <span className="u-price text-2xl">{money(total)}</span>
              </div>

              <a href="/checkout" tabIndex={open ? 0 : -1} className="btn btn-mango mt-4 w-full">
                Ir a pagar
              </a>
              <p className="u-mono mt-2.5 text-center text-ink/35">
                {mode === "envio" ? "Entrega en 25 min" : "Listo en 15 min"} · Pago seguro
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

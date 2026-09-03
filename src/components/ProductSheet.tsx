"use client";

import { useEffect, useMemo, useState } from "react";
import VesselArt from "./VesselArt";
import { useCart } from "./CartProvider";
import {
  MAX_QTY,
  SWEETNESS,
  defaultOptions,
  money,
  offerPriceOf,
  priceOf,
  toppingPrice,
  unitPrice,
  type LineOptions,
} from "@/lib/cart";
import { useSite } from "./SiteProvider";

/**
 * Hoja de personalización. Sirve para agregar y para editar una línea que ya
 * está en el carrito: se abre desde el menú o desde el propio carrito.
 */
export default function ProductSheet() {
  const { sheet, closeSheet, add, replaceLine, lineByKey } = useCart();
  const { toppings, sizes, builderBases } = useSite();
  const product = sheet?.product ?? null;
  const editing = sheet?.lineKey ? lineByKey(sheet.lineKey) : undefined;

  // El equipo puede quedarse sin bases o sin tamaños; la hoja no debe romperse.
  const blank = defaultOptions(builderBases[0]?.name ?? "", sizes[0]?.id ?? "");

  const [options, setOptions] = useState<LineOptions>(blank);
  const [qty, setQty] = useState(1);

  // Al abrir: opciones de la línea que se edita, o valores por defecto.
  useEffect(() => {
    if (!product) return;
    setOptions(editing?.options ?? blank);
    setQty(editing?.qty ?? 1);
    // La identidad de la hoja es el producto y la línea, no el objeto `editing`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, sheet?.lineKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSheet]);

  /*
   * El precio depende del vaso, así que se recalcula cada vez que se cambia el
   * tamaño; no se puede fijar al abrir la hoja.
   *
   * Con oferta del día se aplica la misma rebaja en todos los vasos: se fija
   * sobre el más pequeño y los demás guardan su diferencia de siempre.
   */
  const offer = sheet?.offer;
  const basePrice = product
    ? offer
      ? offerPriceOf(product, offer.basePrice, options.size, sizes)
      : priceOf(product, options.size, sizes)
    : 0;
  const offerLabel = editing?.offerLabel ?? offer?.offerLabel;
  const listPrice = product && offerLabel ? priceOf(product, options.size, sizes) : undefined;
  const unit = useMemo(
    () => unitPrice(basePrice, options, toppings),
    [basePrice, options, toppings],
  );

  if (!product) return null;

  const cap = Math.min(editing?.maxQty ?? offer?.maxQty ?? MAX_QTY, MAX_QTY);
  const set = <K extends keyof LineOptions>(k: K, v: LineOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  const toggleExtra = (name: string) =>
    setOptions((o) => ({
      ...o,
      extras: o.extras.includes(name) ? o.extras.filter((n) => n !== name) : [...o.extras, name],
    }));

  const save = () => {
    const input = {
      productId: product.id,
      name: product.name,
      color: product.color,
      basePrice,
      listPrice,
      offerLabel,
      maxQty: editing?.maxQty ?? offer?.maxQty,
      // Sin esto, personalizar la bebida del día la fusionaría con la misma
      // bebida a precio de lista y el servidor le cobraría el precio completo.
      keySuffix: editing?.keySuffix ?? offer?.keySuffix,
      qty,
      options,
    };
    if (editing) replaceLine(editing.key, input);
    else add(input);
    closeSheet();
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={product.name}>
      <button
        type="button"
        onClick={closeSheet}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        aria-label="Cerrar"
      />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col rounded-t-[32px] border-t-[1.5px] border-ink bg-paper sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[90svh] sm:max-w-3xl sm:rounded-[32px] sm:border-[1.5px] sm:shadow-[8px_10px_0_0_var(--color-ink)]">
        <div className="flex shrink-0 items-center justify-between border-b-[1.5px] border-ink/10 px-5 py-3">
          <span className="u-mono text-ink/45">{editing ? "Editar" : "Personalizar"}</span>
          <button
            type="button"
            onClick={closeSheet}
            className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-ink"
            aria-label="Cerrar"
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

        <div className="grid gap-6 overflow-y-auto p-5 sm:grid-cols-[0.85fr_1.15fr] sm:p-7">
          <div>
            <div
              className="mx-auto w-[52%] max-w-[200px] sm:w-full"
              style={{ filter: "drop-shadow(4px 6px 0 rgba(27,11,46,0.10))" }}
            >
              <VesselArt
                uid={`sheet-${product.id}`}
                vessel={product.vessel}
                color={product.color}
                ingredients={product.ingredients}
                media={product.media}
                width={600}
                className="h-auto w-full"
                alt={product.name}
              />
            </div>
            <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex">
              {product.ingredients.map((ing) => (
                <span
                  key={ing.name}
                  className="u-mono flex items-center gap-1.5 rounded-full border-[1.5px] border-ink/15 px-2.5 py-1 text-ink/60"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: ing.color }} />
                  {ing.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="u-display text-4xl sm:text-5xl">{product.name}</h3>
              {offerLabel ? (
                <span className="sticker shrink-0" style={{ background: "#8FD14F" }}>
                  {offerLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-2 leading-relaxed text-ink/62">{product.tagline}</p>
            {listPrice && listPrice > basePrice ? (
              <p className="u-mono mt-2 text-ink/45">
                {money(basePrice)}{" "}
                <span className="text-ink/35 line-through">{money(listPrice)}</span>
              </p>
            ) : null}

            {sizes.length > 0 ? (
              <Field label="Tamaño">
                <div className="grid grid-cols-2 gap-2">
                  {sizes.map((s) => (
                    <Choice
                      key={s.id}
                      active={options.size === s.id}
                      onClick={() => set("size", s.id)}
                    >
                      {s.label} · {s.volume}
                      {/* Cada vaso enseña lo que cuesta, no un recargo: es el
                          precio lo que cambia, no un extra que se suma. */}
                      <span className="u-mono mt-0.5 block opacity-70">
                        {money(
                          offer
                            ? offerPriceOf(product, offer.basePrice, s.id, sizes)
                            : priceOf(product, s.id, sizes),
                        )}
                      </span>
                    </Choice>
                  ))}
                </div>
              </Field>
            ) : null}

            <Field label="Base">
              <div className="grid grid-cols-2 gap-2">
                {builderBases.map((b) => (
                  <Choice
                    key={b.name}
                    active={options.base === b.name}
                    onClick={() => set("base", b.name)}
                  >
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ background: b.color }}
                    />
                    {b.name}
                  </Choice>
                ))}
              </div>
            </Field>

            <Field label="Dulzor">
              <div className="grid grid-cols-3 gap-2">
                {SWEETNESS.map((s) => (
                  <Choice
                    key={s.id}
                    active={options.sweet === s.id}
                    onClick={() => set("sweet", s.id)}
                  >
                    {s.label}
                  </Choice>
                ))}
              </div>
            </Field>

            <Field label="Toppings">
              <div className="flex flex-wrap gap-2">
                {toppings.map((t) => (
                  <Choice
                    key={t.name}
                    active={options.extras.includes(t.name)}
                    onClick={() => toggleExtra(t.name)}
                  >
                    {t.name} <span className="text-ink/40">+{money(t.price)}</span>
                  </Choice>
                ))}
              </div>
            </Field>

            <Field label="Notas para la barra">
              <textarea
                value={options.note}
                onChange={(e) => set("note", e.target.value)}
                rows={2}
                maxLength={140}
                placeholder="Sin miel, extra frío, alergia a la nuez…"
                /* 16 px: por debajo de eso, iOS hace zoom al enfocar */
                className="w-full resize-none rounded-2xl border-[1.5px] border-ink/20 bg-white px-4 py-3 text-base outline-none placeholder:text-ink/30 focus:border-ink"
              />
            </Field>

            {options.extras.length > 0 ? (
              <p className="u-mono mt-3 text-ink/45">
                {money(basePrice)} + toppings{" "}
                {money(options.extras.reduce((n, e) => n + toppingPrice(e, toppings), 0))}
              </p>
            ) : null}
          </div>
        </div>

        {/* Acción siempre visible: en móvil el pulgar no debe buscarla */}
        <div className="shrink-0 border-t-[1.5px] border-ink/12 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-1 rounded-full border-[1.5px] border-ink p-1">
              <Step onClick={() => setQty((q) => Math.max(1, q - 1))} label="Quitar uno">
                −
              </Step>
              <span className="u-mono w-7 text-center text-sm">{qty}</span>
              <Step onClick={() => setQty((q) => Math.min(cap, q + 1))} label="Agregar uno">
                +
              </Step>
            </div>
            <button type="button" onClick={save} className="btn btn-mango min-w-0 flex-1">
              {editing ? "Guardar" : "Agregar"} · {money(unit * qty)}
            </button>
          </div>
          {qty >= cap && cap < MAX_QTY ? (
            <p className="u-mono mt-2 text-ink/45">Es todo lo que queda hoy</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="u-mono mb-2.5 text-ink/45">{label}</p>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-2xl border-[1.5px] px-3.5 py-2.5 text-left text-[0.85rem] transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-ink/20 bg-white text-ink hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Step({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full text-lg transition-colors hover:bg-ink hover:text-paper"
    >
      {children}
    </button>
  );
}

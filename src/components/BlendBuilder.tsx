"use client";

import { useMemo, useState } from "react";
import SectionHead from "./SectionHead";
import InkField from "./InkField";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { money } from "@/lib/cart";

const MAX = 3;
const BASE_PRICE = 18900;
const THIRD_INGREDIENT = 3000;

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (rgb: number[]) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** Mezcla sustractiva sencilla: las tintas se oscurecen entre sí, la base aclara. */
function mixColors(inks: string[], base: string) {
  if (inks.length === 0) return base;
  const acc = inks
    .map(hexToRgb)
    .reduce((a, c) => a.map((v, i) => (v * c[i]) / 255), [255, 255, 255]);
  const b = hexToRgb(base);
  const lifted = acc.map((v, i) => v * 0.86 + b[i] * 0.14);
  const boosted = lifted.map((v) => v + (255 - v) * 0.08);
  return rgbToHex(boosted);
}

const NAMES = [
  "Terco",
  "Descalzo",
  "Eléctrico",
  "Nocturno",
  "Tranquilo",
  "Insistente",
  "Recién Hecho",
];

export default function BlendBuilder() {
  const { add } = useCart();
  const { sections, builderBases, builderIngredients } = useSite();
  const [baseName, setBaseName] = useState(builderBases[0].name);
  const [picked, setPicked] = useState<string[]>(["Mango", "Maracuyá"]);

  // Se guarda el nombre, no el objeto: el equipo puede editar las bases.
  const base = builderBases.find((b) => b.name === baseName) ?? builderBases[0];

  const inks = picked
    .map((n) => builderIngredients.find((i) => i.name === n)?.color)
    .filter(Boolean) as string[];

  const color = useMemo(() => mixColors(inks, base.color), [inks, base.color]);
  const kcal = 90 + picked.length * 42 + (base.name.includes("avena") ? 55 : 20);
  const price = BASE_PRICE + Math.max(0, picked.length - 2) * THIRD_INGREDIENT;
  const name = picked.length
    ? `${picked[0]} ${NAMES[(picked.length + picked[0].length) % NAMES.length]}`
    : "Tu blend";

  const toggle = (n: string) =>
    setPicked((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length >= MAX ? prev : [...prev, n],
    );

  return (
    <section id="constructor" className="relative overflow-hidden bg-ink py-20 text-paper lg:py-28">
      <InkField
        tone="dark"
        blobs={[
          { color: "#7B3FF2", size: 44, x: -10, y: 10, opacity: 0.4 },
          { color: color, size: 38, x: 68, y: 34, opacity: 0.32 },
          { color: "#FF6A1A", size: 26, x: 30, y: 74, opacity: 0.26 },
        ]}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <SectionHead copy={sections.builder} tone={color} invert />

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          {/* Vista previa. En móvil va primero y compacta. */}
          <div className="order-1">
            <div className="relative rounded-[30px] border-[1.5px] border-paper/20 bg-paper/[0.04] p-6 backdrop-blur-sm">
              <div className="relative mx-auto grid h-44 w-44 place-items-center sm:h-72 sm:w-72">
                <span
                  className="absolute inset-0 rounded-full transition-colors duration-700"
                  style={{ background: color, filter: "blur(28px)", opacity: 0.55 }}
                />
                <span
                  className="relative h-32 w-32 rounded-full border-[1.5px] border-paper/40 transition-colors duration-700 sm:h-52 sm:w-52"
                  style={{ background: color }}
                />
                {inks.map((c, i) => (
                  <span
                    key={i}
                    className="drift absolute h-20 w-20 rounded-full sm:h-32 sm:w-32"
                    style={{
                      background: c,
                      mixBlendMode: "screen",
                      opacity: 0.5,
                      transform: `translate(${[-30, 28, 0][i]}px, ${[24, 16, -34][i]}px)`,
                      animationDelay: `${i * -5}s`,
                    }}
                  />
                ))}
              </div>

              <div className="mt-5 text-center sm:mt-6">
                <p className="u-mono text-paper/45">Se llamaría</p>
                <p className="u-display mt-1 text-3xl sm:text-5xl">{name}</p>
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-2 border-t-[1.5px] border-paper/15 pt-5 text-center">
                <Stat label="Color" value={color.toUpperCase()} />
                <Stat label="Kcal" value={String(kcal)} />
                <Stat label="Precio" value={money(price)} />
              </dl>
            </div>
          </div>

          {/* Controles */}
          <div className="order-2">
            <p className="u-mono mb-3 text-paper/50">Base</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {builderBases.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setBaseName(b.name)}
                  aria-pressed={base.name === b.name}
                  className={`rounded-2xl border-[1.5px] px-3 py-3 text-left text-[0.8rem] leading-tight transition-colors ${
                    base.name === b.name
                      ? "border-paper bg-paper text-ink"
                      : "border-paper/25 text-paper/75 hover:border-paper"
                  }`}
                >
                  <span
                    className="mb-1.5 block h-3 w-3 rounded-full"
                    style={{ background: b.color }}
                  />
                  {b.name}
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-baseline justify-between">
              <p className="u-mono text-paper/50">Ingredientes</p>
              {/* El color vive aquí también: al elegir, la preview puede quedar fuera de pantalla */}
              <p className="u-mono flex items-center gap-2 text-paper/50">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-paper/40 transition-colors duration-500"
                  style={{ background: color }}
                />
                {picked.length} de {MAX}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {builderIngredients.map((ing) => {
                const on = picked.includes(ing.name);
                const full = picked.length >= MAX && !on;
                return (
                  <button
                    key={ing.name}
                    type="button"
                    onClick={() => toggle(ing.name)}
                    aria-pressed={on}
                    disabled={full}
                    className={`flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-2.5 text-[0.85rem] transition-all ${
                      on
                        ? "border-paper bg-paper text-ink"
                        : full
                          ? "cursor-not-allowed border-paper/12 text-paper/25"
                          : "border-paper/25 text-paper/80 hover:border-paper"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: ing.color }} />
                    {ing.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={picked.length === 0}
                onClick={() =>
                  add({
                    productId: "custom",
                    keySuffix: `${base.name}-${picked.join("+")}`,
                    name,
                    color,
                    basePrice: price,
                    custom: [base.name, ...picked],
                  })
                }
                className="btn btn-mango flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/60 transition-colors duration-500"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                Agregar · {money(price)}
              </button>
              <button
                type="button"
                onClick={() => setPicked([])}
                className="btn btn-ghost border-paper/30 text-paper/80 hover:bg-paper/10"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="u-mono text-paper/40">{label}</dt>
      <dd className="u-mono mt-1 text-[0.72rem] text-paper">{value}</dd>
    </div>
  );
}

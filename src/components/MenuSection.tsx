"use client";

import { useState } from "react";
import SectionHead from "./SectionHead";
import VesselArt from "./VesselArt";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { defaultOptions, money } from "@/lib/cart";

export default function MenuSection() {
  const [cat, setCat] = useState("todo");
  const { add, openSheet } = useCart();
  const { sections, categories, products, builderBases } = useSite();

  const list = cat === "todo" ? products : products.filter((p) => p.category === cat);
  const active = categories.find((c) => c.id === cat);

  return (
    <section id="menu" className="relative bg-paper py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <SectionHead copy={sections.menu} tone="#8FD14F" />

        {/* Filtros. Pegajosos bajo la barra en móvil: la lista es larga. */}
        <div className="sticky top-[4.25rem] z-30 -mx-4 mt-10 border-b-[1.5px] border-ink/10 bg-paper/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          <div className="rail">
            <FilterPill active={cat === "todo"} onClick={() => setCat("todo")}>
              Todo <span className="opacity-45">{products.length}</span>
            </FilterPill>
            {categories.map((c) => {
              const n = products.filter((p) => p.category === c.id).length;
              return (
                <FilterPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                  {c.name} <span className="opacity-45">{n}</span>
                </FilterPill>
              );
            })}
          </div>
        </div>

        <p className="u-mono mt-4 text-ink/40">{active?.note ?? "Fruta congelada, nunca hielo"}</p>

        {/* Rejilla */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {list.map((p) => (
            <article
              key={p.id}
              className={`card-ink group flex flex-col p-4 sm:p-5 ${p.soldOut ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                {p.soldOut ? (
                  <span className="sticker" style={{ background: "#EFE4FF" }}>
                    Agotado
                  </span>
                ) : p.badge ? (
                  <span
                    className="sticker"
                    style={{ background: p.badge === "Nuevo" ? "#8FD14F" : "#FFD166" }}
                  >
                    {p.badge}
                  </span>
                ) : (
                  <span className="u-mono text-ink/30">{p.kcal} kcal</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => openSheet(p)}
                disabled={p.soldOut}
                className="relative mx-auto my-1 w-[72%] max-w-[170px] transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-105 disabled:cursor-not-allowed"
                style={{ filter: "drop-shadow(3px 5px 0 rgba(27,11,46,0.09))" }}
                aria-label={`Personalizar ${p.name}`}
              >
                <VesselArt
                  uid={`menu-${p.id}`}
                  vessel={p.vessel}
                  color={p.color}
                  ingredients={p.ingredients}
                  media={p.media}
                  className="h-auto w-full"
                  alt={p.name}
                />
              </button>

              {/* En móvil no hay botón "Editar": el nombre y la ilustración abren la hoja. */}
              <button
                type="button"
                onClick={() => openSheet(p)}
                disabled={p.soldOut}
                className="text-left disabled:cursor-not-allowed"
              >
                <h3 className="u-display text-[1.35rem] leading-none sm:text-[1.75rem] lg:text-3xl">
                  {p.name}
                </h3>
                <p className="mt-2 line-clamp-2 text-[0.8rem] leading-snug text-ink/60 sm:text-[0.9rem]">
                  {p.tagline}
                </p>
              </button>

              <div className="mt-3 flex gap-1.5">
                {p.ingredients.map((ing) => (
                  <span
                    key={ing.name}
                    title={ing.name}
                    className="h-3 w-3 rounded-full border border-ink/25"
                    style={{ background: ing.color }}
                  />
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-4 sm:pt-5">
                <span className="u-display text-2xl sm:text-3xl">{money(p.price)}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openSheet(p)}
                    disabled={p.soldOut}
                    className="u-mono hidden min-h-11 items-center rounded-full border-[1.5px] border-ink/20 px-3 text-ink/60 transition-colors hover:border-ink hover:text-ink disabled:opacity-40 sm:inline-flex"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={p.soldOut}
                    onClick={() =>
                      add({
                        productId: p.id,
                        name: p.name,
                        color: p.color,
                        basePrice: p.price,
                        options: defaultOptions(builderBases[0].name),
                      })
                    }
                    className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink bg-mango text-white transition-transform active:scale-95 disabled:bg-ink/20 disabled:text-ink/40"
                    aria-label={`Agregar ${p.name} al pedido`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M8 1v14M1 8h14"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FilterPill({
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
      className={`u-mono flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-4 transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-ink/20 bg-white text-ink/70 hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

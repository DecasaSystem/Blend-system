"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SectionHead from "./SectionHead";
import VesselArt from "./VesselArt";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { defaultOptions, fromPrice, money, priceOf } from "@/lib/cart";

/**
 * Productos por página. Doce se reparte parejo en las rejillas de 2, 3 y 4
 * columnas: ninguna página termina con una fila coja.
 */
const PAGE_SIZE = 12;

export default function MenuSection() {
  const [cat, setCatState] = useState("todo");
  const [page, setPage] = useState(1);
  const { add, openSheet } = useCart();
  const { sections, categories, products, builderBases, sizes } = useSite();
  /** Marca fija justo antes de los filtros: a dónde se vuelve al cambiar de página. */
  const topRef = useRef<HTMLDivElement>(null);

  const all = cat === "todo" ? products : products.filter((p) => p.category === cat);
  const active = categories.find((c) => c.id === cat);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  // Si el equipo quita productos con la página abierta, no quedarse en una página vacía.
  const current = Math.min(page, pages);
  const list = all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const setCat = (id: string) => {
    setCatState(id);
    setPage(1);
  };

  const goTo = (n: number) => {
    setPage(n);
    const el = topRef.current;
    if (!el) return;
    // Bajo la barra de navegación, que es fija (4.25rem en móvil, algo más en PC).
    const nav = window.matchMedia("(min-width: 1024px)").matches ? 96 : 76;
    const top = el.getBoundingClientRect().top + window.scrollY - nav;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section id="menu" className="scroll-mt-[-4.5rem] lg:scroll-mt-[-6.5rem] relative bg-paper py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <SectionHead copy={sections.menu} tone="#8FD14F" />

        <div ref={topRef} aria-hidden="true" />
        {/* Filtros. Pegajosos bajo la barra en móvil: la lista es larga. */}
        <div className="sticky top-[4.25rem] z-30 -mx-4 mt-10 border-b-[1.5px] border-ink/10 bg-paper/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          <CategoryRail activeKey={cat}>
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
          </CategoryRail>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="u-mono text-ink/40">{active?.note ?? "Fruta congelada, nunca hielo"}</p>
          {pages > 1 ? (
            <p className="u-mono text-ink/40">
              {(current - 1) * PAGE_SIZE + 1}–{(current - 1) * PAGE_SIZE + list.length} de{" "}
              {all.length}
            </p>
          ) : null}
        </div>

        {/* Rejilla. Cuatro columnas sólo desde xl: en un portátil de 1024–1280 px
            la carta quedaba en 180–245 px de contenido y el pie (precio + Editar
            + agregar, ~250 px) no cabía: el precio se montaba sobre «Editar». */}
        {/* Dos columnas desde 360 px; por debajo (iPhone SE, Galaxy pequeños)
            una tarjeta de 136 px no deja sitio ni al precio ni a la foto. */}
        <div className="mt-8 grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <article
              key={p.id}
              // `@container`: el botón «Editar» decide si se muestra según el
              // ancho real de la carta, no el de la pantalla.
              className={`card-ink group @container flex flex-col p-4 sm:p-5 ${p.soldOut ? "opacity-60" : ""}`}
            >
              {/* Altura fija aunque no haya etiqueta: si no, la foto de esa
                  tarjeta sube y la fila queda desalineada. */}
              <div className="flex min-h-7 items-start justify-between gap-2">
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
                ) : null}
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
                  mediaScale={p.mediaScale}
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
                <p className="mt-2 line-clamp-3 text-[0.8rem] leading-snug text-ink/60 sm:line-clamp-2 sm:text-[0.9rem]">
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

              <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 pt-4 @[14rem]:gap-2 sm:pt-5">
                {/* El menú anuncia el vaso más barato; el resto se ve al elegir.
                    «desde» va encima, en su propia línea, y el tamaño del precio
                    lo decide el ancho real de la tarjeta (`@container`): en la
                    rejilla de un teléfono mide 150–170 px y con el precio grande
                    el botón de agregar se le montaba encima. Si aun así no cabe,
                    el botón baja a su propia línea (`flex-wrap` + `ml-auto`). */}
                <span className="u-price min-w-0 text-[0.95rem] @[14rem]:text-lg @[18rem]:text-xl">
                  {sizes.length > 1 ? (
                    <span className="u-mono block text-[0.55rem] leading-none text-ink/40">
                      desde
                    </span>
                  ) : null}
                  {money(fromPrice(p))}
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {/* Sólo si la carta tiene ≥ 16rem de contenido, que es lo que
                      cabe junto al precio. En móvil y en cartas estrechas el
                      nombre y la ilustración ya abren la hoja. */}
                  <button
                    type="button"
                    onClick={() => openSheet(p)}
                    disabled={p.soldOut}
                    className="u-mono hidden min-h-11 items-center rounded-full border-[1.5px] border-ink/20 px-3 text-ink/60 transition-colors hover:border-ink hover:text-ink disabled:opacity-40 @[16rem]:inline-flex"
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
                        basePrice: priceOf(p, sizes[0]?.id, sizes),
                        options: defaultOptions(builderBases[0]?.name ?? "", sizes[0]?.id ?? ""),
                      })
                    }
                    className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-ink bg-mango text-white transition-transform active:scale-95 disabled:bg-ink/20 disabled:text-ink/40 @[14rem]:h-11 @[14rem]:w-11"
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

        {pages > 1 ? <Pagination page={current} pages={pages} onChange={goTo} /> : null}
      </div>
    </section>
  );
}

/**
 * El riel de categorías. En móvil se desliza con el dedo; en PC no hay
 * barra de scroll ni gesto, así que las que no caben quedaban inalcanzables.
 * Ahora hay flechas a los lados (sólo cuando queda algo por ese lado), un
 * desvanecido que avisa que la fila sigue, y la categoría elegida se trae a
 * la vista.
 */
function CategoryRail({ activeKey, children }: { activeKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  // La categoría elegida, siempre entera a la vista.
  useEffect(() => {
    const el = ref.current;
    const pill = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !pill) return;
    const pad = 48;
    if (pill.offsetLeft < el.scrollLeft + pad) {
      el.scrollTo({ left: pill.offsetLeft - pad, behavior: "smooth" });
    } else if (pill.offsetLeft + pill.offsetWidth > el.scrollLeft + el.clientWidth - pad) {
      el.scrollTo({ left: pill.offsetLeft + pill.offsetWidth - el.clientWidth + pad, behavior: "smooth" });
    }
  }, [activeKey]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  /*
   * Con el mouse, sin tener que atinarle a nada:
   * - Acercarse a un borde desliza la fila hacia ese lado, más rápido cuanto
   *   más cerca del borde (zona de 96 px).
   * - Arrastrar con el botón apretado la mueve como con el dedo; si hubo
   *   arrastre, el clic de soltar no cambia de categoría.
   * - La rueda vertical la mueve en horizontal mientras quede fila por ese
   *   lado; al llegar al final, la rueda vuelve a mover la página.
   * En pantallas táctiles nada de esto aplica: ahí se desliza con el dedo.
   */
  const glide = useRef<{ speed: number; raf: number }>({ speed: 0, raf: 0 });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const stopGlide = () => {
    cancelAnimationFrame(glide.current.raf);
    glide.current = { speed: 0, raf: 0 };
  };
  useEffect(() => stopGlide, []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;

    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > 5) drag.current.moved = true;
      el.scrollLeft = drag.current.left - dx;
      return;
    }

    const box = el.getBoundingClientRect();
    const zone = 96;
    const fromLeft = e.clientX - box.left;
    const fromRight = box.right - e.clientX;
    const speed =
      fromLeft < zone && edges.left
        ? -((zone - fromLeft) / zone) * 9
        : fromRight < zone && edges.right
          ? ((zone - fromRight) / zone) * 9
          : 0;
    glide.current.speed = speed;
    if (speed && !glide.current.raf) {
      const tick = () => {
        const r = ref.current;
        if (!r || !glide.current.speed) {
          glide.current.raf = 0;
          return;
        }
        r.scrollLeft += glide.current.speed;
        glide.current.raf = requestAnimationFrame(tick);
      };
      glide.current.raf = requestAnimationFrame(tick);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    stopGlide();
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  };

  const endDrag = () => {
    // Se suelta un momento después: el `click` que sigue todavía debe saber si hubo arrastre.
    setTimeout(() => {
      drag.current = null;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const canGo =
        e.deltaY > 0
          ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1
          : el.scrollLeft > 0;
      if (!canGo) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    // `passive: false`: si no, el navegador no deja frenar el scroll de la página.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fade = `linear-gradient(to right, ${edges.left ? "transparent, #000 3rem" : "#000"}, ${
    edges.right ? "#000 calc(100% - 3rem), transparent" : "#000"
  })`;

  return (
    // Los eventos del mouse van en el contenedor, no en la fila: así el
    // deslizamiento sigue mientras el cursor está sobre las flechas.
    <div
      className="relative"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        stopGlide();
        if (drag.current) endDrag();
      }}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* `md:snap-none`: con el imán de `.rail` el deslizamiento de a pocos
          píxeles volvería siempre a la píldora de antes. */}
      <div
        ref={ref}
        className="rail relative select-none md:snap-none"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
        role="group"
        aria-label="Categorías del menú"
      >
        {children}
      </div>
      <RailArrow dir={-1} show={edges.left} onClick={() => nudge(-1)} />
      <RailArrow dir={1} show={edges.right} onClick={() => nudge(1)} />
    </div>
  );
}

function RailArrow({ dir, show, onClick }: { dir: -1 | 1; show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      aria-label={dir < 0 ? "Ver categorías anteriores" : "Ver más categorías"}
      className={`absolute top-0 z-10 hidden h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink bg-white text-ink shadow-[2px_3px_0_0_var(--color-ink)] transition-[opacity,transform] duration-200 hover:-translate-y-px hover:bg-pulp active:translate-y-px active:shadow-none md:grid ${
        dir < 0 ? "left-0" : "right-0"
      } ${show ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Chevron dir={dir} />
    </button>
  );
}

function Chevron({ dir }: { dir: -1 | 1 }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d={dir < 0 ? "M9 2 4 7l5 5" : "M5 2l5 5-5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Números a mostrar: siempre la primera, la última y las vecinas de la actual. */
function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, Math.min(page - 1, pages - 4));
  const to = Math.min(pages - 1, Math.max(page + 1, 5));
  if (from > 2) out.push("…");
  for (let n = from; n <= to; n++) out.push(n);
  if (to < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (n: number) => void;
}) {
  const step =
    "flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-ink px-4 shadow-[2px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-none disabled:pointer-events-none disabled:border-ink/15 disabled:text-ink/30 disabled:shadow-none";

  return (
    <nav aria-label="Páginas del menú" className="mt-12 flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-center">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className={`u-mono ${step} bg-white text-ink hover:bg-pulp`}
        >
          <Chevron dir={-1} />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* En teléfonos pequeños los números no caben: «3 / 7» en su lugar. */}
        <span className="u-mono text-ink/60 sm:hidden">
          {page} / {pages}
        </span>

        <ol className="hidden items-center gap-1.5 sm:flex">
          {pageItems(page, pages).map((n, i) =>
            n === "…" ? (
              <li key={`gap-${i}`} className="u-mono w-6 text-center text-ink/35" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => onChange(n)}
                  aria-current={n === page ? "page" : undefined}
                  aria-label={`Página ${n}`}
                  className={`u-mono grid h-11 min-w-11 place-items-center rounded-full border-[1.5px] px-2 transition-colors ${
                    n === page
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/20 bg-white text-ink/70 hover:border-ink hover:text-ink"
                  }`}
                >
                  {n}
                </button>
              </li>
            ),
          )}
        </ol>

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          aria-label="Página siguiente"
          className={`u-mono ${step} bg-mango text-white hover:bg-mango-deep disabled:bg-white`}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <Chevron dir={1} />
        </button>
      </div>
    </nav>
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

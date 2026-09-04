"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Logo from "../Logo";
import VesselArt from "../VesselArt";
import ProductSheet from "../ProductSheet";
import KioskIdle from "./KioskIdle";
import KioskHome from "./KioskHome";
import { useCart } from "../CartProvider";
import { useSite } from "../SiteProvider";
import { describe, defaultOptions, fromPrice, money, priceOf } from "@/lib/cart";
import { lockKiosk, placeKioskOrder } from "@/actions/kiosk";
import type { KioskConfig } from "@/lib/content";

/**
 * Autopedido del mostrador.
 *
 * Pensada para una pantalla táctil de pie, no para un móvil en la mano: todo
 * es grande, hay una sola columna de decisiones y ningún dato personal más que
 * un nombre para cantar el pedido.
 *
 * Reutiliza el carrito y la hoja de personalización de la tienda a propósito.
 * Así los precios, los tamaños y los adicionales salen del mismo sitio y no
 * hay dos formas de calcular un total. Lo que cambia es la piel.
 */

/** Tras entregar el pedido, la pantalla vuelve sola a estar libre. */
const VOLVER_EN = 12;

type Pago = "tarjeta" | "efectivo" | "transferencia";

const PAGOS: { id: Pago; icono: string; nombre: string; nota: string }[] = [
  {
    id: "tarjeta",
    icono: "💳",
    nombre: "Tarjeta",
    nota: "En la barra te pasan el datáfono.",
  },
  {
    id: "efectivo",
    icono: "💵",
    nombre: "Efectivo",
    nota: "Pagas en la barra, en pesos.",
  },
  {
    id: "transferencia",
    icono: "📱",
    nombre: "Transferencia",
    nota: "Los datos de transferencia están en la barra.",
  },
];

export default function KioskOrder({
  tienda,
  etiqueta,
  kiosk,
}: {
  tienda: string;
  etiqueta: string;
  kiosk: KioskConfig;
}) {
  const router = useRouter();
  const site = useSite();
  const { lines, count, subtotal, add, setQty, remove, clear, openSheet } = useCart();

  const [caja, setCaja] = useState<string | null>(null);
  const [cat, setCat] = useState("todo");
  const [paso, setPaso] = useState<"idle" | "home" | "menu" | "confirmar">("idle");
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [pago, setPago] = useState<Pago>("tarjeta");
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState(VOLVER_EN);
  const [pendiente, empezar] = useTransition();

  const activa = kiosk.categories.find((c) => c.id === caja);

  const productos = useMemo(() => {
    if (!activa) return [];
    // Batidos del día: los tres publicados, con su precio de oferta.
    if (activa.useDaily) {
      return site.dailyIds
        .map((id) => site.products.find((p) => p.id === id))
        .filter((p) => p !== undefined);
    }
    // Crispetas y combos: productos que sólo existen en el quiosco.
    if (activa.extraProducts && activa.extraProducts.length > 0) {
      return activa.extraProducts;
    }
    // Batidos: el catálogo de la web filtrado por las categorías de la caja.
    const base =
      activa.categoryIds.length > 0
        ? site.products.filter((p) => activa.categoryIds.includes(p.category))
        : site.products;
    return cat === "todo" ? base : base.filter((p) => p.category === cat);
  }, [activa, cat, site.products, site.dailyIds]);

  // Sub-categorías dentro de la caja (sólo si la caja agrupa varias).
  const subcats = useMemo(() => {
    if (!activa || activa.useDaily || (activa.extraProducts?.length ?? 0) > 0) return [];
    if (activa.categoryIds.length < 2) return [];
    return site.categories.filter((c) => activa.categoryIds.includes(c.id));
  }, [activa, site.categories]);

  // El carrito de la tienda vive en el mismo navegador; una pantalla de
  // mostrador tiene que empezar vacía o el primer cliente hereda lo de antes.
  useEffect(() => {
    clear();
    // Sólo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta atrás de la pantalla de "listo", para dejarla libre al siguiente.
  useEffect(() => {
    if (!listo) return;
    if (cuenta <= 0) {
      setListo(null);
      setPaso("idle");
      setCaja(null);
      setCat("todo");
      setNombre("");
      setNotas("");
      setCuenta(VOLVER_EN);
      return;
    }
    const t = setTimeout(() => setCuenta((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [listo, cuenta]);

  const enviar = () => {
    setError(null);
    empezar(async () => {
      // Recoger no lleva domicilio, así que el total es el subtotal.
      const res = await placeKioskOrder(lines, nombre, notas, subtotal, pago);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      clear();
      setCuenta(VOLVER_EN);
      setListo(res.id);
    });
  };

  /* ---------------- Espera ---------------- */
  if (paso === "idle" && !listo) {
    return <KioskIdle kiosk={kiosk} tienda={tienda} onTocar={() => setPaso("home")} />;
  }

  /* ---------------- Cajas ---------------- */
  if (paso === "home" && !listo) {
    return (
      <KioskHome
        cajas={kiosk.categories}
        tienda={tienda}
        etiqueta={etiqueta}
        onVolver={() => setPaso("idle")}
        onElegir={(id) => {
          setCaja(id);
          setCat("todo");
          setPaso("menu");
        }}
      />
    );
  }

  /* ---------------- Pedido entregado ---------------- */
  if (listo) {
    return (
      <main className="grid min-h-svh place-items-center bg-ink px-6 text-center text-paper">
        <div>
          <div className="mx-auto flex justify-center" aria-hidden="true">
            <span className="h-20 w-20 rounded-full bg-mango" style={{ mixBlendMode: "screen" }} />
            <span
              className="-ml-7 h-20 w-20 rounded-full bg-ube"
              style={{ mixBlendMode: "screen" }}
            />
            <span
              className="-ml-7 h-20 w-20 rounded-full bg-matcha"
              style={{ mixBlendMode: "screen" }}
            />
          </div>

          {/* El número en su propia línea: es lo único que la persona tiene
              que recordar, y en una sola línea con el texto se salía de la
              pantalla en cuanto el pedido pasara de cuatro cifras. */}
          <p className="u-mono mt-10 text-base text-paper/50">Tu número es</p>
          <p className="u-display text-[clamp(3.5rem,14vw,8rem)] leading-none text-mango">
            {listo}
          </p>
          <p className="mt-6 text-xl leading-relaxed text-paper/70">
            Pasa a la barra a pagar y te lo preparamos.
          </p>

          <button
            type="button"
            onClick={() => {
              setListo(null);
              setPaso("idle");
              setCaja(null);
              setCat("todo");
              setNombre("");
              setNotas("");
              setCuenta(VOLVER_EN);
            }}
            className="btn btn-mango mt-10"
          >
            Pedir otra cosa
          </button>
          <p className="u-mono mt-6 text-paper/35">Vuelve al inicio en {cuenta}</p>
        </div>
      </main>
    );
  }

  /* ---------------- Confirmar ---------------- */
  if (paso === "confirmar") {
    return (
      <main className="min-h-svh bg-paper">
        <Barra tienda={tienda} etiqueta={etiqueta} onSalir={() => router.refresh()} />

        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="u-display text-[clamp(2.2rem,6vw,3.4rem)]">
            ¿A nombre de <span className="u-italic text-mango">quién?</span>
          </h1>
          <p className="mt-3 text-lg text-ink/62">
            Sólo el nombre, para cantarlo cuando esté listo. Se paga en la barra.
          </p>

          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            maxLength={60}
            placeholder="Camila"
            aria-label="Nombre para el pedido"
            className="mt-6 w-full rounded-2xl border-[1.5px] border-ink bg-white px-5 py-5 text-2xl outline-none placeholder:text-ink/25 focus:border-mango"
          />

          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Alergias o algo que debamos saber (opcional)"
            className="mt-3 w-full resize-none rounded-2xl border-[1.5px] border-ink/20 bg-white px-5 py-4 text-base outline-none placeholder:text-ink/30 focus:border-ink"
          />

          <ul className="mt-8 divide-y-[1.5px] divide-ink/10 border-y-[1.5px] border-ink/10">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-4 py-4">
                <span
                  className="h-10 w-10 shrink-0 rounded-full border-[1.5px] border-ink"
                  style={{ background: l.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium leading-tight">
                    {l.qty}× {l.name}
                  </p>
                  {describe(l, site.sizes) ? (
                    <p className="u-mono mt-0.5 normal-case tracking-[0.01em] text-ink/45">
                      {describe(l, site.sizes)}
                    </p>
                  ) : null}
                </div>
                <span className="u-price shrink-0 text-lg">{money(l.unitPrice * l.qty)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-end justify-between">
            <span className="u-mono text-ink/50">Total</span>
            <span className="u-price text-3xl">{money(subtotal)}</span>
          </div>

          {/* Cómo vas a pagar. No hay pasarela: la barra cobra. Esto sólo le
              avisa a la barra (tarjeta → alistar el datáfono) y queda en el
              pedido del tablero. */}
          <h2 className="u-display mt-10 text-3xl">¿Cómo pagas?</h2>
          <div className="mt-4 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Método de pago">
            {PAGOS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={pago === m.id}
                onClick={() => setPago(m.id)}
                className={`flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] p-3 transition-colors ${
                  pago === m.id
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/20 bg-white text-ink"
                }`}
              >
                <span className="text-3xl" aria-hidden="true">
                  {m.icono}
                </span>
                <span className="text-base font-medium">{m.nombre}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-ink/60">{PAGOS.find((m) => m.id === pago)?.nota}</p>

          {error ? (
            <p className="u-mono mt-4 text-mango-deep" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={enviar}
              disabled={pendiente || !nombre.trim() || count === 0}
              className="btn btn-mango flex-1 py-5 text-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pendiente ? "Enviando…" : `Enviar a la barra · ${money(subtotal)}`}
            </button>
            <button
              type="button"
              onClick={() => setPaso("menu")}
              className="btn btn-paper py-5 text-lg"
            >
              ← Seguir pidiendo
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ---------------- Menú ---------------- */
  return (
    <main className="min-h-svh bg-paper pb-32">
      <Barra tienda={tienda} etiqueta={etiqueta} onSalir={() => router.refresh()} />

      <div className="mx-auto max-w-6xl px-5 py-6">
        <button
          type="button"
          onClick={() => {
            setPaso("home");
            setCaja(null);
            setCat("todo");
          }}
          className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-5 text-ink/50"
        >
          ← Todas las opciones
        </button>
        <h1 className="u-display mt-4 text-[clamp(2.2rem,6vw,3.4rem)]">
          {activa ? (
            <>
              {activa.icon} {activa.name}
            </>
          ) : (
            <>
              Toca lo que <span className="u-italic text-mango">quieras</span>
            </>
          )}
        </h1>

        {/* Sub-categorías: sólo si la caja agrupa varias. */}
        {subcats.length > 0 ? (
          <div className="rail -mx-5 mt-5 px-5 pb-2" role="tablist" aria-label="Categorías">
            <Pastilla activa={cat === "todo"} onClick={() => setCat("todo")}>
              Todo
            </Pastilla>
            {subcats.map((c) => (
              <Pastilla key={c.id} activa={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </Pastilla>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {productos.map((p) => (
            <article
              key={p.id}
              className={`card-ink flex flex-col p-4 ${p.soldOut ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                disabled={p.soldOut}
                onClick={() => openSheet(p)}
                className="flex flex-1 flex-col text-left disabled:cursor-not-allowed"
                aria-label={`Elegir ${p.name}`}
              >
                <div className="mx-auto my-2 w-[70%] max-w-[150px]">
                  <VesselArt
                    uid={`kiosco-${p.id}`}
                    vessel={p.vessel}
                    color={p.color}
                    ingredients={p.ingredients}
                    media={p.media}
                    className="h-auto w-full"
                    alt={p.name}
                  />
                </div>
                <h2 className="u-display text-2xl leading-none">{p.name}</h2>
                <p className="mt-2 line-clamp-2 text-[0.85rem] leading-snug text-ink/60">
                  {p.tagline}
                </p>
                <span className="u-price mt-3 text-lg">
                  {site.sizes.length > 1 ? (
                    <span className="u-mono block text-[0.55rem] leading-none text-ink/40">
                      desde
                    </span>
                  ) : null}
                  {money(fromPrice(p))}
                </span>
              </button>

              <button
                type="button"
                disabled={p.soldOut}
                onClick={() => {
                  // Las crispetas tienen precio único ("unica"); priceOf no lo
                  // encuentra entre los vasos de la tienda y daría cero.
                  const base = priceOf(p, site.sizes[0]?.id, site.sizes) || fromPrice(p);
                  add({
                    productId: p.id,
                    name: p.name,
                    color: p.color,
                    basePrice: base,
                    options: defaultOptions(
                      site.builderBases[0]?.name ?? "",
                      site.sizes[0]?.id ?? "unica",
                    ),
                  });
                }}
                className="btn btn-mango mt-4 w-full py-4 disabled:bg-ink/20 disabled:text-ink/40"
              >
                {p.soldOut ? "Agotado" : "Agregar"}
              </button>
            </article>
          ))}
        </div>
      </div>

      {/* El carrito vive abajo, siempre a la vista y siempre al alcance del pulgar. */}
      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-ink bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-6xl items-center gap-4">
            <div className="rail min-w-0 flex-1">
              {lines.map((l) => (
                <span
                  key={l.key}
                  className="flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-ink/20 py-1 pl-3 pr-1"
                >
                  <span className="whitespace-nowrap text-[0.9rem]">
                    {l.qty}× {l.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => (l.qty > 1 ? setQty(l.key, l.qty - 1) : remove(l.key))}
                    aria-label={`Quitar uno de ${l.name}`}
                    className="grid h-9 w-9 place-items-center rounded-full text-ink/50 hover:bg-ink hover:text-paper"
                  >
                    −
                  </button>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPaso("confirmar")}
              className="btn btn-mango shrink-0 py-4 text-base"
            >
              Listo · {money(subtotal)}
            </button>
          </div>
        </div>
      ) : null}

      {/* La misma hoja de personalización de la tienda: un solo sitio calcula precios. */}
      <ProductSheet />
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Barra({
  tienda,
  etiqueta,
  onSalir,
}: {
  tienda: string;
  etiqueta: string;
  onSalir: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
        <Logo size={28} />
        <span className="u-display text-2xl">BLEND</span>
        <span className="u-mono ml-auto text-ink/40">
          {tienda} · {etiqueta}
        </span>
        <Candado onSalir={onSalir} />
      </div>
    </header>
  );
}

/**
 * Salir de la pantalla pide la clave.
 *
 * Sin eso, cualquier cliente podría cerrar el quiosco por curiosidad y dejar
 * la tienda sin autopedido hasta que alguien se diera cuenta.
 */
function Candado({ onSalir }: { onSalir: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Cerrar la pantalla de autopedido"
        className="u-mono grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/15 text-ink/30"
      >
        <svg width="14" height="14" viewBox="0 0 14 16" aria-hidden="true">
          <path
            d="M3 7V4.5a4 4 0 0 1 8 0V7M2 7h10v7H2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {abierto ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/60 px-6">
          <div className="w-full max-w-sm rounded-[26px] border-[1.5px] border-ink bg-paper p-6">
            <h2 className="u-display text-2xl">Cerrar el autopedido</h2>
            <p className="mt-2 text-ink/62">Hace falta la clave del quiosco.</p>
            <input
              type="password"
              value={clave}
              autoFocus
              onChange={(e) => setClave(e.target.value)}
              className="input mt-4 rounded-2xl"
            />
            {error ? <p className="u-mono mt-2 text-mango-deep">{error}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  empezar(async () => {
                    const res = await lockKiosk(clave);
                    if ("error" in res) {
                      setError(res.error);
                      setClave("");
                      return;
                    }
                    onSalir();
                  })
                }
                className="btn btn-sm btn-mango flex-1"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  setClave("");
                  setError(null);
                }}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-4 text-ink/60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border-[1.5px] px-6 py-3.5 text-lg transition-colors ${
        activa ? "border-ink bg-ink text-paper" : "border-ink/20 bg-white text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}

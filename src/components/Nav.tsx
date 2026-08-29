"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import { useCart } from "./CartProvider";

const LINKS = [
  { href: "#del-dia", label: "Del día" },
  { href: "#menu", label: "Menú" },
  { href: "#constructor", label: "Arma tu blend" },
  { href: "#tiendas", label: "Tiendas" },
  { href: "#contacto", label: "Contacto" },
];

export default function Nav({ signedIn = false }: { signedIn?: boolean }) {
  const { count, setOpen } = useCart();
  const [sheet, setSheet] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          stuck
            ? "border-b-[1.5px] border-ink bg-paper/92 backdrop-blur-md"
            : "border-b-[1.5px] border-transparent"
        }`}
      >
        <nav className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <a href="#top" className="flex min-h-11 items-center gap-2.5" aria-label="BLEND, inicio">
            <Logo size={32} />
            <span className="u-display text-2xl font-semibold tracking-tight">BLEND</span>
          </a>

          <ul className="ml-auto hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="u-mono rounded-full px-3.5 py-2 text-ink/70 transition-colors hover:bg-ink hover:text-paper"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-2 lg:ml-3">
            <a
              href={signedIn ? "/cuenta" : "/cuenta/entrar"}
              className="u-mono hidden min-h-11 items-center rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink sm:inline-flex"
            >
              {signedIn ? "Mi cuenta" : "Entrar"}
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn btn-sm btn-paper relative h-11 w-11 gap-2 px-0 sm:w-auto sm:px-4"
              aria-label={`Abrir carrito, ${count} ${count === 1 ? "artículo" : "artículos"}`}
            >
              <svg
                width="16"
                height="17"
                viewBox="0 0 16 17"
                aria-hidden="true"
                className="shrink-0"
              >
                <path
                  d="M2 5h12l-1 10.5H3L2 5Zm3.2 0V3.6a2.8 2.8 0 0 1 5.6 0V5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Carrito</span>
              <span
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.6rem] transition-colors ${
                  count > 0
                    ? "absolute -right-1 -top-1 bg-mango text-white sm:static sm:right-auto sm:top-auto"
                    : "hidden sm:grid sm:bg-ink/10 sm:text-ink/50"
                }`}
              >
                {count}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink lg:hidden"
              aria-label="Abrir menú"
            >
              <span className="sr-only">Menú</span>
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                <path
                  d="M0 1h18M0 6h18M0 11h12"
                  stroke="#1B0B2E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Hoja de navegación en móvil */}
      <div
        className={`fixed inset-0 z-[70] lg:hidden ${sheet ? "" : "pointer-events-none"}`}
        aria-hidden={!sheet}
      >
        <button
          type="button"
          tabIndex={sheet ? 0 : -1}
          onClick={() => setSheet(false)}
          className={`absolute inset-0 bg-ink/45 backdrop-blur-sm transition-opacity duration-300 ${
            sheet ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Cerrar menú"
        />
        <div
          className={`absolute inset-x-3 top-3 rounded-[28px] border-[1.5px] border-ink bg-paper p-5 shadow-[6px_8px_0_0_var(--color-ink)] transition-all duration-300 ${
            sheet ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <span className="u-display text-2xl">BLEND</span>
            </div>
            <button
              type="button"
              tabIndex={sheet ? 0 : -1}
              onClick={() => setSheet(false)}
              className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-ink"
              aria-label="Cerrar menú"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="#1B0B2E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <ul className="mt-5 grid gap-1">
            {LINKS.map((l, i) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  tabIndex={sheet ? 0 : -1}
                  onClick={() => setSheet(false)}
                  className="u-display flex items-baseline gap-3 rounded-2xl px-2 py-3 text-4xl transition-colors hover:bg-paper-2"
                >
                  <span className="u-mono text-[0.6rem] text-ink/35">0{i + 1}</span>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="rule my-4" />
          <a
            href={signedIn ? "/cuenta" : "/cuenta/entrar"}
            tabIndex={sheet ? 0 : -1}
            onClick={() => setSheet(false)}
            className="u-mono flex min-h-11 items-center justify-between text-ink/55"
          >
            {signedIn ? "Mi cuenta" : "Entrar a mi cuenta"} <span aria-hidden="true">→</span>
          </a>
          <a
            href="/equipo"
            tabIndex={sheet ? 0 : -1}
            onClick={() => setSheet(false)}
            className="u-mono flex min-h-11 items-center justify-between text-ink/35"
          >
            Vista de equipo <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </>
  );
}

"use client";

import Logo from "../Logo";
import type { KioskCategory } from "@/lib/content";

/**
 * Menú principal del quiosco: las tres cajas grandes.
 *
 * Una sola decisión por pantalla, botones del tamaño de la palma. Cada caja
 * abre el catálogo filtrado de KioskOrder.
 */
export default function KioskHome({
  cajas,
  tienda,
  etiqueta,
  onElegir,
  onVolver,
}: {
  cajas: KioskCategory[];
  tienda: string;
  etiqueta: string;
  onElegir: (id: string) => void;
  onVolver: () => void;
}) {
  return (
    <main className="min-h-svh bg-paper pb-10">
      <header className="border-b-[1.5px] border-ink bg-paper/95">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <Logo size={28} />
          <span className="u-display text-2xl">BLEND</span>
          <span className="u-mono ml-auto text-ink/40">
            {tienda} · {etiqueta}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="u-display text-[clamp(2.2rem,6vw,3.4rem)]">
          ¿Qué te <span className="u-italic text-mango">apetece?</span>
        </h1>
        <p className="mt-3 text-lg text-ink/62">Toca una opción para ver el menú.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {cajas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onElegir(c.id)}
              className="card-ink flex min-h-[220px] flex-col items-start justify-between p-6 text-left transition-transform active:scale-[0.98]"
            >
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl border-[1.5px] border-ink text-3xl"
                style={{ background: c.color }}
                aria-hidden="true"
              >
                {c.icon}
              </span>
              <span>
                <span className="u-display block text-3xl leading-none">{c.name}</span>
                <span className="u-mono mt-2 block text-ink/45">Toca para ver →</span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onVolver}
          className="u-mono mt-8 min-h-11 rounded-full border-[1.5px] border-ink/20 px-5 text-ink/50"
        >
          ← Volver a la pantalla de espera
        </button>
      </div>
    </main>
  );
}

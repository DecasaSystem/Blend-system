"use client";

import { useState } from "react";
import SectionHead from "./SectionHead";
import StoreMap from "./StoreMap";
import { useSite } from "./SiteProvider";

export default function Stores() {
  const { brand, stores, sections } = useSite();
  const [activeId, setActiveId] = useState(stores[0]?.id ?? "");
  const active = stores.find((s) => s.id === activeId) ?? stores[0];

  if (!active) return null;

  return (
    <section id="tiendas" className="relative bg-paper py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <SectionHead copy={sections.stores} tone="#7B3FF2" />

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          {/* Mapa. min-w-0: sin esto el riel de sucursales estira la columna. */}
          <div className="card-ink min-w-0 overflow-hidden p-0 hover:translate-x-0 hover:translate-y-0 hover:shadow-[4px_5px_0_0_var(--color-ink)]">
            {/* Más alto en móvil: los pines se apiñan y la atribución ocupa dos líneas */}
            <div className="relative aspect-square w-full sm:aspect-[16/10]">
              <StoreMap stores={stores} activeId={activeId} onSelect={setActiveId} />
            </div>
          </div>

          {/* Detalle + lista */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="card-ink p-6 hover:translate-x-0 hover:translate-y-0 hover:shadow-[4px_5px_0_0_var(--color-ink)]">
              <p className="u-mono text-ink/40">Seleccionada</p>
              <h3 className="u-display mt-1 text-4xl">{active.name}</h3>
              <p className="mt-2 leading-relaxed text-ink/65">{active.address}</p>

              <dl className="u-mono mt-5 grid grid-cols-2 gap-3 border-t-[1.5px] border-ink/10 pt-5">
                <div>
                  <dt className="text-ink/40">Horario</dt>
                  <dd className="mt-1 text-ink">{active.hours}</dd>
                </div>
                <div>
                  <dt className="text-ink/40">Teléfono</dt>
                  <dd className="mt-1 text-ink">{active.phone}</dd>
                </div>
              </dl>

              <ul className="mt-4 flex flex-wrap gap-1.5">
                {active.services.map((s) => (
                  <li
                    key={s}
                    className="u-mono rounded-full border-[1.5px] border-ink/15 px-2.5 py-1 text-ink/60"
                  >
                    {s}
                  </li>
                ))}
              </ul>

              <a
                className="btn btn-ube mt-6 w-full"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${active.address}, ${brand.city}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Cómo llegar
              </a>
            </div>

            <div
              data-store-list
              className="rail -mx-1 min-w-0 px-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:overflow-visible lg:px-0"
            >
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  aria-pressed={s.id === activeId}
                  className={`u-mono min-w-[140px] rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition-colors ${
                    s.id === activeId
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/20 bg-white text-ink/65 hover:border-ink"
                  }`}
                >
                  {s.area}
                  <span className="mt-1 block text-[0.58rem] opacity-55">{s.hours}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

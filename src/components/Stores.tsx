"use client";

import { useState } from "react";
import SectionHead from "./SectionHead";
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
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
              <svg
                viewBox="0 0 100 75"
                className="h-full w-full"
                role="img"
                aria-label="Mapa de las tiendas"
              >
                <rect width="100" height="75" fill="#F1E7FF" />

                {/* Parque */}
                <path
                  d="M8 8 C24 2 40 6 44 18 C48 30 34 38 20 36 C6 34 0 18 8 8 Z"
                  fill="#8FD14F"
                  opacity="0.55"
                />
                {/* Agua */}
                <path
                  d="M0 60 C22 52 34 68 56 60 C74 53 86 66 100 58 L100 75 L0 75 Z"
                  fill="#7B3FF2"
                  opacity="0.18"
                />

                {/* Manzanas */}
                <g fill="#1B0B2E" opacity="0.07">
                  {[
                    [52, 8, 14, 9],
                    [70, 6, 11, 12],
                    [86, 12, 10, 8],
                    [50, 26, 9, 11],
                    [64, 24, 16, 8],
                    [86, 26, 9, 13],
                    [14, 44, 12, 9],
                    [30, 42, 10, 12],
                    [46, 44, 13, 8],
                    [66, 40, 12, 10],
                    [84, 44, 11, 8],
                  ].map(([x, y, w, h], k) => (
                    <rect key={k} x={x} y={y} width={w} height={h} rx="1.2" />
                  ))}
                </g>

                {/* Avenidas */}
                <g stroke="#1B0B2E" strokeOpacity="0.16" strokeWidth="0.7" fill="none">
                  <path d="M0 22 H100M0 40 H100M0 55 H100" />
                  <path d="M48 0 V75M62 0 V75M82 0 V75M28 0 V75" />
                  <path d="M0 70 C30 62 60 74 100 66" strokeWidth="1.1" strokeOpacity="0.22" />
                </g>

                {/* Pines */}
                {stores.map((s) => {
                  const on = s.id === activeId;
                  return (
                    <g
                      key={s.id}
                      transform={`translate(${s.x} ${s.y})`}
                      onClick={() => setActiveId(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveId(s.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={`Ver ${s.name}`}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Área táctil: ~50 px en pantalla de móvil */}
                      <circle r="9" fill="#1B0B2E" opacity="0" />
                      {on ? <circle cx="0" cy="-6.4" r="8" fill="#1B0B2E" opacity="0.12" /> : null}
                      <path
                        d="M0 0 L-2 -3.6 L2 -3.6 Z"
                        fill="#1B0B2E"
                        transform="translate(0 0.4)"
                      />
                      <g
                        style={{ mixBlendMode: "multiply" }}
                        transform="translate(0 -6.4) scale(0.72)"
                      >
                        <circle cx="-1.7" cy="-1.4" r="3.1" fill="#FF6A1A" />
                        <circle cx="1.7" cy="-1.2" r="3.1" fill="#7B3FF2" />
                        <circle cx="0" cy="1.6" r="3.1" fill="#8FD14F" />
                      </g>
                      <circle
                        cx="0"
                        cy="-6.4"
                        r="4.5"
                        fill="none"
                        stroke="#1B0B2E"
                        strokeWidth={on ? "1.1" : "0.55"}
                      />
                      <text
                        x="0"
                        y="6.4"
                        textAnchor="middle"
                        fontSize="2.4"
                        fill="#1B0B2E"
                        opacity={on ? 1 : 0.45}
                        style={{ fontFamily: "var(--font-martian)", letterSpacing: "0.06em" }}
                      >
                        {s.area.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* En móvil choca con las etiquetas de los pines */}
              <p className="u-mono absolute bottom-2 right-3 hidden text-ink/30 sm:block">
                Mapa ilustrado · {brand.city}
              </p>
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

            <div className="rail -mx-1 min-w-0 px-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:overflow-visible lg:px-0">
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

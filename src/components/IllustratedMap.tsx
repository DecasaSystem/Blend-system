"use client";

import { project } from "@/lib/geo";
import type { Store } from "@/lib/content";

/**
 * Mapa dibujado. Es el respaldo cuando el mapa real no carga (sin conexión,
 * red bloqueada) y lo que se ve mientras el otro descarga.
 */
export default function IllustratedMap({
  stores,
  activeId,
  onSelect,
  interactive = true,
}: {
  stores: Store[];
  activeId: string;
  onSelect: (id: string) => void;
  /** En falso queda de puro fondo: ni foco de teclado ni lectores de pantalla. */
  interactive?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 75" className="h-full w-full" role="img" aria-label="Mapa de las tiendas">
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
        const { x, y } = project(s);
        return (
          <g
            key={s.id}
            transform={`translate(${x} ${y})`}
            onClick={interactive ? () => onSelect(s.id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(s.id);
                    }
                  }
                : undefined
            }
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? on : undefined}
            aria-label={interactive ? `Ver ${s.name}` : undefined}
            style={{ cursor: interactive ? "pointer" : "default" }}
          >
            {/* Área táctil: ~50 px en pantalla de móvil */}
            <circle r="9" fill="#1B0B2E" opacity="0" />
            {on ? <circle cx="0" cy="-6.4" r="8" fill="#1B0B2E" opacity="0.12" /> : null}
            <path d="M0 0 L-2 -3.6 L2 -3.6 Z" fill="#1B0B2E" transform="translate(0 0.4)" />
            <g style={{ mixBlendMode: "multiply" }} transform="translate(0 -6.4) scale(0.72)">
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
  );
}

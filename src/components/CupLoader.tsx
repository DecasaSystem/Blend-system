import { useId } from "react";

/**
 * Indicador de carga de la casa: el vaso para llevar de BLEND llenándose.
 *
 * Es el mismo recipiente `cup` de `VesselArt`, para que la espera se vea de
 * la familia de las cartas. El líquido sube con olitas y burbujas, se llena,
 * y vuelve a empezar. Con `prefers-reduced-motion` se queda quieto a media
 * altura: se entiende igual que algo está en marcha sin nada moviéndose.
 *
 * Tres tamaños de uso:
 *   - `<CupLoader />` solo, dentro de un botón, a 18 px: hereda el color del
 *     texto porque el trazo es `currentColor`.
 *   - `<CupLoader size={64} label="Cargando…" />` en el hueco de una lista.
 *   - `<LoadingScreen />` a pantalla completa, para `loading.tsx`.
 */

const BODY =
  "M57 80 L143 80 L132 236 C131.4 243 125.8 248 119 248 L81 248 C74.2 248 68.6 243 68 236 Z";
const LID =
  "M46 58 L154 58 C158 58 161 61 161 65 L161 74 C161 78 158 81 154 81 L46 81 C42 81 39 78 39 74 L39 65 C39 61 42 58 46 58 Z";

/* Ola de 100 px de periodo repetida seis veces: el grupo se desplaza 100 px
   en bucle y el empalme no se nota. Empieza en y=254, justo bajo el fondo del
   vaso (248), para que el primer fotograma sea un vaso vacío. */
const WAVE = (() => {
  let d = "M-200 254";
  for (let i = 0; i < 6; i++) d += " q 25 -12 50 0 t 50 0";
  return `${d} L400 600 L-200 600 Z`;
})();

export function CupLoader({
  size = 18,
  tone = "var(--color-ube)",
  empty = "#fffdfb",
  label,
  className = "",
}: {
  /** Ancho en píxeles. El alto sale de la proporción del vaso (200×268). */
  size?: number;
  /** Color del líquido. */
  tone?: string;
  /** Color de la tapa; debe combinar con el fondo donde se pinta. */
  empty?: string;
  /** Texto bajo el vaso. Sin él, el vaso va solo (p. ej. dentro de un botón). */
  label?: string;
  className?: string;
}) {
  const clip = `cup-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const height = Math.round((size * 268) / 200);

  const svg = (
    <svg
      width={size}
      height={height}
      viewBox="0 0 200 268"
      className={label ? "" : `inline-block align-[-0.2em] ${className}`}
      // Sombra plana de la casa sólo en los tamaños grandes; a 18 px ensucia.
      style={label ? { filter: "drop-shadow(3px 5px 0 rgba(27,11,46,0.10))" } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* Popote detrás, como en las cartas: la tapa lo tapa por abajo. */}
      <path
        d="M116 70 L134 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path d="M116 70 L134 16" fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" />

      <path d={BODY} fill={empty} />

      <g clipPath={`url(#${clip})`}>
        <g className="cup-fill">
          <g className="cup-wave">
            <path d={WAVE} fill={tone} />
          </g>
        </g>
        {/* Burbujas que suben por dentro del líquido, escalonadas. */}
        {[
          { cx: 84, r: 6, delay: "0s" },
          { cx: 112, r: 4.5, delay: "-0.9s" },
          { cx: 98, r: 3.5, delay: "-1.6s" },
        ].map((b) => (
          <circle
            key={b.cx}
            className="cup-bubble"
            cx={b.cx}
            cy={240}
            r={b.r}
            fill="#fffdfb"
            opacity="0.55"
            style={{ animationDelay: b.delay }}
          />
        ))}
      </g>

      <path d={BODY} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path
        d={LID}
        fill={empty}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!label) return svg;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 text-center ${className}`}
    >
      {svg}
      <p className="u-mono text-ink/45">{label}</p>
    </div>
  );
}

/** Pantalla completa, para `loading.tsx` y esperas largas. */
export default function LoadingScreen({ label = "Preparando…" }: { label?: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-6 text-ink">
      <CupLoader size={112} label={label} className="rise" />
    </div>
  );
}

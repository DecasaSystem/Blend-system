"use client";

import { useSite } from "./SiteProvider";

/**
 * Marca. Si el equipo subió un logo, se usa ese; si no, se dibujan las tres
 * tintas sobreimpresas, que es el sistema visual del sitio.
 */
export default function Logo({ size = 34 }: { size?: number }) {
  const { brand } = useSite();

  if (brand.logo) {
    return (
      <span
        className="block shrink-0 overflow-hidden rounded-[28%] border-[1.5px] border-ink/15"
        style={{ width: size, height: size }}
      >
        {/* El archivo trae un margen casi blanco alrededor; se recorta con scale. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.logo}
          alt={brand.name}
          className="h-full w-full scale-[1.08] object-cover"
        />
      </span>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" className="shrink-0">
      <g style={{ mixBlendMode: "multiply" }}>
        <circle cx="16" cy="16" r="13" fill="#FF6A1A" />
        <circle cx="28" cy="17" r="13" fill="#7B3FF2" />
        <circle cx="22" cy="28" r="13" fill="#8FD14F" />
      </g>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#1B0B2E" strokeWidth="1.6" />
      <circle cx="28" cy="17" r="13" fill="none" stroke="#1B0B2E" strokeWidth="1.6" />
      <circle cx="22" cy="28" r="13" fill="none" stroke="#1B0B2E" strokeWidth="1.6" />
    </svg>
  );
}

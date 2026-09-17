"use client";

import { useState } from "react";

/**
 * La cara del asistente.
 *
 * Es la imagen de /public/asistente.png recortada en círculo. Debajo va
 * siempre la chispa sobre naranja, y la foto se pone encima sólo cuando ya
 * cargó: así nunca se ve un hueco ni el icono de imagen rota, y si el
 * archivo no existe queda la chispa. Cambiar la cara es cambiar el archivo.
 */
export const ASSISTANT_FACE = "/asistente.png";

export default function AssistantFace({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const [state, setState] = useState<"cargando" | "lista" | "sin">("cargando");
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-mango text-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>✦</span>
      {state !== "sin" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ASSISTANT_FACE}
          alt=""
          width={size}
          height={size}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            state === "lista" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setState("lista")}
          onError={() => setState("sin")}
        />
      ) : null}
    </span>
  );
}

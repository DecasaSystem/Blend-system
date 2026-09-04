"use client";

import { useState } from "react";

/**
 * El ojo para ver la contraseña que se está escribiendo.
 *
 * Devuelve el tipo del campo y el botón, en vez de envolver el `<input>`: los
 * dos formularios que lo usan tienen su propia forma de pintar campos —uno
 * sobre papel y otro sobre tinta— y no merece la pena unificarlos por esto.
 *
 * Lo que sí unifica es el comportamiento, que es donde están los detalles que
 * se olvidan: que el botón no envíe el formulario, que diga en voz alta si la
 * contraseña está a la vista, y que vuelva a taparse sola al enviar.
 */
export function usePasswordEye() {
  const [visible, setVisible] = useState(false);

  return {
    /** Para el `type` del input. */
    type: visible ? "text" : "password",
    visible,
    /** Vuelve a taparla; se llama al enviar el formulario. */
    hide: () => setVisible(false),
    /** El botón, ya posicionado dentro del campo. */
    eye: <Eye visible={visible} onToggle={() => setVisible((v) => !v)} />,
  };
}

function Eye({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      // `aria-pressed` cuenta el estado; la etiqueta dice qué hará al pulsarlo.
      aria-pressed={visible}
      aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
      title={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
      // `currentColor` y opacidad: hereda el color del formulario que lo use,
      // así funciona igual sobre papel que sobre tinta.
      className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-current opacity-45 transition-opacity hover:opacity-90 focus-visible:opacity-90"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {/* Tachado cuando está a la vista: el ojo abierto no dice por sí solo
            si la contraseña se ve o no. */}
        {visible ? <path d="M4 20 20 4" /> : null}
      </svg>
    </button>
  );
}

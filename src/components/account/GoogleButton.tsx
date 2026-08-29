"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signInWithGoogle } from "@/actions/account";

/**
 * Botón de "Entrar con Google".
 *
 * Google dibuja su propio botón dentro del hueco que le damos: no se puede
 * imitar con nuestro estilo, es condición de uso de la marca. El token que
 * devuelve se manda al servidor, que es quien lo verifica.
 */

type GoogleId = {
  initialize: (opts: {
    client_id: string;
    callback: (res: { credential?: string }) => void;
    cancel_on_tap_outside?: boolean;
    auto_select?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
  prompt: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export default function GoogleButton({
  clientId,
  oneTap = false,
}: {
  clientId: string;
  /** La ventanita que sale sola. Sólo en las pantallas de cuenta. */
  oneTap?: boolean;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    const start = () => {
      const id = window.google?.accounts?.id;
      if (cancelled || !id || !slot.current) return;

      id.initialize({
        client_id: clientId,
        cancel_on_tap_outside: true,
        callback: (res) => {
          if (!res.credential) {
            setError("Google no devolvió nada. Inténtalo otra vez.");
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await signInWithGoogle(res.credential!);
            // Si todo va bien, la acción redirige y esto no se ejecuta.
            if (result?.error) setError(result.error);
          });
        },
      });

      id.renderButton(slot.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        locale: "es",
        width: 320,
      });

      if (oneTap) id.prompt();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.id) start();
      else existing.addEventListener("load", start, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", start, { once: true });
      script.addEventListener("error", () => {
        if (!cancelled) setError("No se pudo cargar Google. Usa tu correo y contraseña.");
      });
      document.head.append(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, oneTap]);

  return (
    <div>
      {/* Alto reservado: sin esto el formulario da un salto cuando Google pinta */}
      <div ref={slot} className="flex min-h-11 justify-center" data-google-slot />
      {error ? (
        <p className="u-mono mt-2 text-center text-mango-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

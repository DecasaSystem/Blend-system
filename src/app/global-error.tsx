"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Último recurso: si lo que falla es el layout raíz, `error.tsx` no alcanza
 * a pintarse (vive dentro de ese layout). Aquí no hay fuentes ni proveedores
 * del sitio, así que va lo mínimo: el aviso y reintentar.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-paper text-ink">
        <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-8">
          <h1 className="text-4xl font-bold">Se nos regó el blend</h1>
          <p className="mt-4 leading-relaxed text-ink/65">
            Algo salió mal de nuestro lado. Inténtalo otra vez en un momento.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => retry()} className="btn btn-mango">
              Reintentar
            </button>
            {/* Enlace normal: el router puede ser justo lo que se cayó. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="btn btn-paper">
              Ir al inicio
            </a>
          </div>
          {error.digest ? (
            <p className="mt-8 font-mono text-sm text-ink/35">Código: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import AccountShell from "@/components/account/AccountShell";

/**
 * Si algo falla en el servidor, la página no queda en blanco con «Minified
 * React error #441»: sale este aviso con la marca y la opción de reintentar.
 * `retry` vuelve a pedir la página al servidor, que suele bastar si fue un
 * tropiezo de red o de la base. El `digest` es lo que se busca en los logs
 * de Vercel para dar con el error real.
 */
export default function Error({
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
    <AccountShell
      eyebrow="Algo falló"
      title="Se nos regó el"
      accent="blend"
      lead="Algo salió mal de nuestro lado. Inténtalo otra vez; si sigue pasando, vuelve al inicio."
    >
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-mango">
          Reintentar
        </button>
        <Link href="/" className="btn btn-paper">
          Ir al inicio
        </Link>
      </div>
      {error.digest ? (
        <p className="u-mono mt-8 text-ink/35">Código: {error.digest}</p>
      ) : null}
    </AccountShell>
  );
}

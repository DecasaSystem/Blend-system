"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "../Logo";
import InkField from "../InkField";
import OrderBoard from "./OrderBoard";
import { TEAM_PASSWORD, TEAM_SESSION_KEY } from "@/lib/team";

/**
 * Pestillo de acceso. La sesión dura lo que dure la pestaña.
 * En la fase 7 esto se reemplaza por autenticación real en el servidor.
 */
export default function TeamGate() {
  const [state, setState] = useState<"cargando" | "fuera" | "dentro">("cargando");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setState(sessionStorage.getItem(TEAM_SESSION_KEY) === "1" ? "dentro" : "fuera");
    } catch {
      setState("fuera");
    }
  }, []);

  if (state === "cargando") return <div className="min-h-svh bg-ink" />;
  if (state === "dentro") return <OrderBoard />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() !== TEAM_PASSWORD) {
      setError(true);
      setValue("");
      return;
    }
    try {
      sessionStorage.setItem(TEAM_SESSION_KEY, "1");
    } catch {
      /* almacenamiento no disponible */
    }
    setState("dentro");
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-ink text-paper">
      <InkField
        tone="dark"
        blobs={[
          { color: "#7B3FF2", size: 46, x: -12, y: 8, opacity: 0.4 },
          { color: "#FF6A1A", size: 34, x: 66, y: 46, opacity: 0.3 },
        ]}
      />

      <div className="relative mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-16">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <span className="u-display text-3xl">BLEND</span>
          <span className="u-mono ml-auto text-paper/40">Barra</span>
        </div>

        <h1 className="u-display mt-10 text-[clamp(2.4rem,9vw,3.6rem)]">
          Entra a los <span className="u-italic text-mango">pedidos</span>
        </h1>
        <p className="mt-4 text-paper/65">Solo para el equipo de tienda.</p>

        <form onSubmit={submit} className="mt-8">
          <label className="u-mono mb-2 block text-paper/50" htmlFor="team-pass">
            Clave de la tienda
          </label>
          <input
            id="team-pass"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            className={`w-full rounded-full border-[1.5px] bg-transparent px-5 py-3.5 text-base text-paper outline-none placeholder:text-paper/35 focus:border-paper ${
              error ? "border-mango" : "border-paper/30"
            }`}
            placeholder="••••••••"
            aria-invalid={error}
            aria-describedby={error ? "team-error" : undefined}
          />
          {error ? (
            <p id="team-error" className="u-mono mt-2 text-mango">
              Esa clave no es. Pregúntale al encargado del turno.
            </p>
          ) : null}

          <button type="submit" className="btn btn-mango mt-5 w-full">
            Entrar
          </button>
        </form>

        <Link
          href="/"
          className="btn btn-ghost mt-4 self-start border-paper/30 text-paper hover:bg-paper/10"
        >
          ← Volver a la tienda
        </Link>
      </div>
    </main>
  );
}

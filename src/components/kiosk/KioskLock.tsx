"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Logo from "../Logo";
import InkField from "../InkField";
import { unlockKiosk } from "@/actions/kiosk";
import type { Store } from "@/lib/content";

/**
 * Desbloqueo de la pantalla.
 *
 * Lo monta alguien del equipo una vez, cuando pone la tablet en el mostrador:
 * elige la sede, le da un nombre para reconocerla en /equipo, y escribe la
 * clave. A partir de ahí la pantalla se queda desbloqueada tres meses.
 */
export default function KioskLock({ stores, activo }: { stores: Store[]; activo: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    empezar(async () => {
      const res = await unlockKiosk(password, storeId, label);
      if ("error" in res) {
        setError(res.error);
        setPassword("");
        return;
      }
      router.refresh();
    });
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-ink text-paper">
      <InkField
        tone="dark"
        blobs={[
          { color: "#7B3FF2", size: 48, x: -12, y: 6, opacity: 0.4 },
          { color: "#FF6A1A", size: 34, x: 68, y: 52, opacity: 0.28 },
        ]}
      />

      <div className="relative mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <span className="u-display text-3xl">BLEND</span>
          <span className="u-mono ml-auto text-paper/40">Pide aquí</span>
        </div>

        <h1 className="u-display mt-10 text-[clamp(2.2rem,8vw,3.4rem)]">
          Pantalla de <span className="u-italic text-mango">autopedido</span>
        </h1>

        {activo ? (
          <>
            <p className="mt-4 text-paper/65">
              Esto lo configura el equipo una vez. Después la pantalla se queda lista para que los
              clientes pidan solos.
            </p>

            <form onSubmit={enviar} className="mt-8">
              <label className="u-mono mb-2 block text-paper/50" htmlFor="sede">
                Sede
              </label>
              <select
                id="sede"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full appearance-none rounded-full border-[1.5px] border-paper/30 bg-transparent px-5 py-3.5 text-base text-paper outline-none focus:border-paper"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id} className="text-ink">
                    {s.name}
                  </option>
                ))}
              </select>

              <label className="u-mono mb-2 mt-4 block text-paper/50" htmlFor="etiqueta">
                Nombre de la pantalla
              </label>
              <input
                id="etiqueta"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="Tablet de la entrada"
                className="w-full rounded-full border-[1.5px] border-paper/30 bg-transparent px-5 py-3.5 text-base text-paper outline-none placeholder:text-paper/35 focus:border-paper"
              />

              <label className="u-mono mb-2 mt-4 block text-paper/50" htmlFor="clave">
                Clave del quiosco
              </label>
              <input
                id="clave"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="off"
                placeholder="••••••••"
                aria-describedby={error ? "quiosco-error" : undefined}
                className={`w-full rounded-full border-[1.5px] bg-transparent px-5 py-3.5 text-base text-paper outline-none placeholder:text-paper/35 focus:border-paper ${
                  error ? "border-mango" : "border-paper/30"
                }`}
              />

              {error ? (
                <p id="quiosco-error" className="u-mono mt-3 text-mango" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pendiente}
                className="btn btn-mango mt-6 w-full disabled:opacity-60"
              >
                {pendiente ? "Un momento…" : "Activar esta pantalla"}
              </button>
            </form>
          </>
        ) : (
          <p className="mt-6 rounded-2xl border-[1.5px] border-paper/20 px-5 py-4 leading-relaxed text-paper/70">
            El autopedido todavía no está activado. Alguien del equipo tiene que ponerle una clave
            desde <span className="u-mono">/equipo → Cuentas</span>.
          </p>
        )}
      </div>
    </main>
  );
}

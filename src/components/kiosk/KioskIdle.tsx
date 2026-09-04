"use client";

import Logo from "../Logo";
import InkField from "../InkField";
import type { KioskConfig } from "@/lib/content";

/**
 * Pantalla de espera del quiosco.
 *
 * Cuando nadie está pidiendo, la tablet muestra el video en loop. Un toque
 * en cualquier parte despierta el menú. Si no hay video, se dibuja la
 * composición de tintas de la marca.
 */
export default function KioskIdle({
  kiosk,
  tienda,
  onTocar,
}: {
  kiosk: KioskConfig;
  tienda: string;
  onTocar: () => void;
}) {
  if (!kiosk.enabled) {
    return (
      <main className="grid min-h-svh place-items-center bg-ink px-6 text-center text-paper">
        <div>
          <div className="mx-auto flex w-fit items-center gap-3">
            <Logo size={34} />
            <span className="u-display text-3xl">BLEND</span>
          </div>
          <p className="u-display mt-8 text-3xl">El autopedido no está disponible</p>
          <p className="mt-3 text-paper/60">Pide directamente en la barra.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-ink text-paper">
      <button
        type="button"
        onClick={onTocar}
        aria-label="Toca para empezar tu pedido"
        className="absolute inset-0 z-10 h-full w-full cursor-pointer"
      >
        <span className="sr-only">Toca para empezar</span>
      </button>

      {kiosk.idleVideo ? (
        <video
          src={kiosk.idleVideo}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <InkField
          tone="dark"
          blobs={[
            { color: "#7B3FF2", size: 52, x: -12, y: 4, opacity: 0.45 },
            { color: "#FF6A1A", size: 38, x: 66, y: 50, opacity: 0.32 },
            { color: "#8FD14F", size: 30, x: 30, y: 74, opacity: 0.25 },
          ]}
        />
      )}
      <div className="absolute inset-0 bg-ink/45" aria-hidden="true" />

      <div className="pointer-events-none relative z-[5] flex min-h-svh flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="u-display text-2xl">BLEND</span>
          <span className="u-mono text-paper/50">· {tienda}</span>
        </div>
        <h1 className="u-display mt-6 text-[clamp(3rem,10vw,6rem)] leading-none">
          {kiosk.idleTitle}
        </h1>
        <p className="mt-4 text-xl text-paper/70">{kiosk.idleSubtitle}</p>
        <span className="btn btn-mango mt-8 animate-pulse">Toca para empezar</span>
      </div>
    </main>
  );
}

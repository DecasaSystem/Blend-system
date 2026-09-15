"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import { useSite } from "./SiteProvider";

/**
 * «Instalar la app»: la tienda como icono en el teléfono.
 *
 * No hay app en las tiendas de Apple ni Google: la propia página se instala
 * (PWA). El manifest ya tiene todo lo que piden los navegadores; esto es la
 * invitación a hacerlo, y cambia según el aparato:
 *
 * - Chrome/Edge (Android y escritorio) avisan con `beforeinstallprompt`. Se
 *   guarda el evento y el botón abre el diálogo nativo del navegador.
 * - iPhone/iPad no tienen ese evento: hay que ir a Compartir → «Añadir a
 *   pantalla de inicio». Se enseñan los pasos.
 * - Si ya está instalada (se abrió como app), no se enseña nada.
 *
 * Dos formas: `section`, la banda de la portada; `card`, la tarjeta corta
 * que sale tras un pedido y en «Mi cuenta».
 */

type Platform = "ios" | "android" | "desktop";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS se hace pasar por Mac; el touch lo delata.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      // El navegador enseñaría su propio aviso; se guarda para el botón.
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
    return outcome === "accepted";
  };

  return { platform, installed, canPrompt: prompt !== null, install };
}

export default function InstallApp({ variant = "section" }: { variant?: "section" | "card" }) {
  const { brand } = useSite();
  const { platform, installed, canPrompt, install } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  // Antes de saber dónde estamos no se pinta nada: evita que el texto salte.
  if (platform === null || installed) return null;

  const steps = stepsFor(platform, canPrompt);

  const button = canPrompt ? (
    <button type="button" onClick={install} className="btn btn-mango">
      <InstallIcon /> Instalar la app
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setShowSteps((v) => !v)}
      aria-expanded={showSteps}
      className="btn btn-mango"
    >
      <InstallIcon /> {platform === "ios" ? "Instalar en iPhone" : "Cómo instalarla"}
    </button>
  );

  if (variant === "card") {
    return (
      <div className="mt-8 rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4 text-left sm:p-5">
        <div className="flex items-start gap-4">
          <AppIcon size={52} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Llévate {brand.name} al teléfono</p>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-ink/60">
              La próxima vez pides en dos toques, sin abrir el navegador. No pesa nada y no
              hay que descargar nada de ninguna tienda.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">{button}</div>
            {showSteps && !canPrompt ? <Steps steps={steps} compact /> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      id="app"
      className="scroll-mt-[-2.5rem] lg:scroll-mt-[-3.5rem] border-t-[1.5px] border-ink bg-ube text-paper"
    >
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16 lg:px-10 lg:py-20">
        <div className="max-w-2xl">
          <p className="u-mono flex items-center gap-2.5 text-paper/60">
            <span className="inline-block h-2 w-2 rounded-full bg-matcha" aria-hidden="true" />
            La app
          </p>
          <h2 className="u-display mt-4 text-[clamp(2.4rem,7vw,4.6rem)] leading-[0.95]">
            Llévate {brand.name} en el <span className="u-italic text-pulp">bolsillo</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/75">
            Instala la tienda como una app en tu teléfono: un icono en la pantalla de inicio, sin
            pasar por ninguna tienda de aplicaciones y sin ocupar espacio. Pides en dos toques y
            tus sellos te esperan.
          </p>

          <ul className="mt-6 grid gap-2.5 text-paper/80 sm:grid-cols-3">
            {[
              ["Dos toques", "Abre directo en el menú, sin escribir nada."],
              ["Cero peso", "No es una descarga: es la tienda, pero como app."],
              ["Tus sellos", "Con tu cuenta, ves tus pedidos y lo que te falta."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border-[1.5px] border-paper/20 px-4 py-3">
                <p className="font-semibold">{t}</p>
                <p className="mt-0.5 text-[0.9rem] leading-snug text-paper/65">{d}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {button}
            <p className="u-mono text-paper/55">
              {platform === "ios"
                ? "Safari en iPhone o iPad"
                : platform === "android"
                  ? "Chrome en Android"
                  : "Chrome o Edge en el computador"}
            </p>
          </div>

          {showSteps && !canPrompt ? <Steps steps={steps} /> : null}
        </div>

        {/* El icono tal y como quedará en la pantalla de inicio. */}
        <div className="flex justify-center lg:justify-end" aria-hidden="true">
          <div className="relative grid place-items-center rounded-[40px] border-[1.5px] border-paper/25 bg-ink/30 p-8 sm:p-10">
            <span className="absolute -left-4 -top-4 h-16 w-16 rounded-full bg-mango" />
            <span className="absolute -bottom-5 -right-3 h-20 w-20 rounded-full bg-matcha" />
            <AppIcon size={112} />
            <p className="mt-3 text-sm font-medium text-paper">{brand.name}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Los pasos para el aparato de quien mira, cuando el navegador no da botón. */
function stepsFor(platform: Platform, canPrompt: boolean): string[] {
  if (canPrompt) return [];
  if (platform === "ios") {
    return [
      "Abre esta página en Safari (en otros navegadores de iPhone no se puede).",
      "Toca el botón Compartir: el cuadrado con la flecha hacia arriba, abajo en el centro.",
      "Baja en la lista y toca «Añadir a pantalla de inicio».",
      "Toca «Añadir». Listo: el icono queda junto a tus otras apps.",
    ];
  }
  if (platform === "android") {
    return [
      "Abre esta página en Chrome.",
      "Toca el menú ⋮ arriba a la derecha.",
      "Toca «Instalar app» o «Añadir a pantalla de inicio» y confirma.",
    ];
  }
  return [
    "En Chrome o Edge, mira a la derecha de la barra de dirección: hay un icono de instalar.",
    "Si no lo ves, abre el menú ⋮ del navegador → «Guardar y compartir» → «Instalar página como app».",
  ];
}

function Steps({ steps, compact }: { steps: string[]; compact?: boolean }) {
  return (
    <ol
      className={`mt-4 grid gap-2 ${compact ? "text-[0.9rem]" : "max-w-xl text-[0.95rem]"} ${
        compact ? "text-ink/70" : "text-paper/85"
      }`}
    >
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span
            className={`u-mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] text-[0.65rem] ${
              compact ? "border-ink bg-paper text-ink" : "border-paper/40 text-paper"
            }`}
          >
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function AppIcon({ size }: { size: number }) {
  return (
    <span
      className="block overflow-hidden rounded-[24%] shadow-[0_12px_30px_rgba(27,11,46,0.35)]"
      style={{ width: size, height: size }}
    >
      <Logo size={size} />
    </span>
  );
}

function InstallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

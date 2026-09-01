"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InkField from "./InkField";
import VesselArt from "./VesselArt";
import { useSite } from "./SiteProvider";
import { isVideoUrl, mediaSrcSet, mediaUrl } from "@/lib/media";

const DURATION = 7200;

export default function Hero() {
  const { slides, brand } = useSite();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // El equipo puede borrar slides mientras se mira: el índice se queda dentro.
  const slide = slides[Math.min(i, slides.length - 1)];

  const go = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setI((next + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => go(i + 1), DURATION);
    return () => clearTimeout(t);
  }, [i, paused, go, slides.length]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) setPaused(true);
  }, []);

  // Sin slides no hay carrusel: mejor nada que una pantalla rota.
  if (!slide) return null;

  // Cuánto se ve el fondo. Por defecto apagado a la mitad para que el texto lea.
  const mediaOpacity = Math.min(100, Math.max(0, slide.mediaOpacity ?? 55)) / 100;

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-ink text-paper"
      // Solo el ratón pausa: en táctil, "mouseenter" se dispara al tocar y dejaría el carrusel detenido.
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        // Horizontal de verdad: no robar el scroll vertical.
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          go(i + (dx < 0 ? 1 : -1));
        }
        touch.current = null;
      }}
      aria-roledescription="carrusel"
      aria-label="Destacados de la temporada"
    >
      {/* Fondo: video del equipo o composición de tintas */}
      <div className="absolute inset-0 -z-10">
        {slide.media ? (
          isVideoUrl(slide.media) ? (
            <video
              key={slide.id}
              src={mediaUrl(slide.media, { width: 1600 })}
              autoPlay
              muted
              loop
              playsInline
              // El video del carrusel no debe frenar la primera pintada.
              preload="metadata"
              className="h-full w-full object-cover"
              style={{ opacity: mediaOpacity }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={slide.id}
              src={mediaUrl(slide.media, { width: 1600 })}
              srcSet={mediaSrcSet(slide.media, 1600)}
              alt=""
              // Es lo primero que se ve: se pide con prioridad, no en diferido.
              fetchPriority="high"
              className="h-full w-full object-cover"
              style={{ opacity: mediaOpacity }}
            />
          )
        ) : (
          <>
            <InkField
              key={slide.id}
              tone="dark"
              blobs={[
                { color: slide.tone, size: 62, x: 46, y: -14, opacity: 0.55 },
                { color: "#7B3FF2", size: 54, x: 4, y: 30, opacity: 0.45 },
                { color: "#8FD14F", size: 40, x: 62, y: 52, opacity: 0.32 },
                { color: "#FF6A1A", size: 34, x: 22, y: 66, opacity: 0.34 },
              ]}
            />
            <div
              className="swirl absolute -right-[28%] top-[-20%] h-[130%] w-[80%] rounded-full opacity-[0.18]"
              style={{
                background: `conic-gradient(from 0deg, transparent, ${slide.tone}, transparent 55%, #7B3FF2, transparent)`,
              }}
              aria-hidden="true"
            />
          </>
        )}
        {/* Velo para que el titular lea. Sobre una foto se afloja: si no, daría
            igual lo que suba el equipo. La izquierda sigue densa por el texto. */}
        <div
          className={
            slide.media
              ? "absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent"
              : "absolute inset-0 bg-gradient-to-r from-ink via-ink/78 to-ink/25"
          }
        />
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-4 lg:px-10 lg:pb-20 lg:pt-14">
        {/* Texto */}
        <div key={slide.id} className="rise relative order-2 lg:order-1">
          <p className="u-mono mb-5 flex items-center gap-2.5 text-paper/60">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: slide.tone }}
            />
            {slide.kicker}
          </p>

          <h1 className="u-display text-[clamp(3.2rem,13vw,8.5rem)]">
            {slide.title}
            <br />
            <span className="u-italic" style={{ color: slide.tone }}>
              {slide.accent}
            </span>
          </h1>

          <p className="mt-7 max-w-md text-lg leading-relaxed text-paper/72 sm:text-xl lg:mt-9">
            {slide.body}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={slide.cta.href} className="btn btn-mango">
              {slide.cta.label}
            </a>
            <a
              href="#tiendas"
              className="btn btn-ghost border-paper/35 text-paper hover:bg-paper/10"
            >
              Dónde estamos
            </a>
          </div>
        </div>

        {/* Foto del equipo o, si no la han subido, el recipiente ilustrado */}
        <div className="relative order-1 flex justify-center lg:order-2 lg:justify-end">
          <div className="bob w-[42%] max-w-[190px] sm:w-[38%] sm:max-w-[260px] lg:w-full lg:max-w-[400px]">
            {slide.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`art-${slide.id}`}
                src={mediaUrl(slide.art, { width: 800 })}
                srcSet={mediaSrcSet(slide.art, 800)}
                alt=""
                fetchPriority="high"
                className="aspect-square h-auto w-full rounded-[32px] border-[1.5px] border-paper/25 object-cover drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]"
              />
            ) : (
              <VesselArt
                uid={`hero-${slide.id}`}
                vessel={slide.vessel}
                color={slide.tone}
                ingredients={[
                  { name: "", color: "#FF6A1A" },
                  { name: "", color: "#7B3FF2" },
                  { name: "", color: "#8FD14F" },
                ]}
                className="h-auto w-full drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]"
                alt=""
                outline="#F7F1FF"
                empty="#241038"
              />
            )}
          </div>
        </div>
      </div>

      {/* Controles + datos */}
      <div className="relative border-t-[1.5px] border-paper/15">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={idx === i}
                aria-label={`${s.kicker}`}
                onClick={() => go(idx)}
                className="group relative grid h-11 w-16 place-items-center overflow-hidden rounded-full border-[1.5px] border-paper/25"
              >
                <span
                  className="absolute inset-0 origin-left transition-transform duration-500"
                  style={{
                    background: idx === i ? s.tone : "transparent",
                    transform: idx === i ? "scaleX(1)" : "scaleX(0)",
                  }}
                />
                <span
                  className="u-mono relative text-[0.58rem] transition-colors"
                  style={{ color: idx === i ? "#1B0B2E" : "rgba(247,241,255,0.6)" }}
                >
                  0{idx + 1}
                </span>
              </button>
            ))}
          </div>

          <div className="u-mono ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-paper/50">
            <span>{brand.delivery}</span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span>Sin azúcar añadida</span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span>4 tiendas</span>
          </div>
        </div>
      </div>
    </section>
  );
}

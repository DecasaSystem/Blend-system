"use client";

import { useRef, useState } from "react";

/** Piezas de formulario del editor. Sin adornos: esto lo usa el equipo a diario. */

export function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const map = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const;
  return <div className={`grid gap-3 ${map[cols]}`}>{children}</div>;
}

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input rounded-2xl"
      />
      {hint ? <span className="u-mono mt-1 block text-ink/35">{hint}</span> : null}
    </label>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input resize-none rounded-2xl"
      />
    </label>
  );
}

export function Num({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 block text-ink/45">
        {label}
        {suffix ? ` (${suffix})` : ""}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="input rounded-2xl"
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input appearance-none rounded-2xl"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border-[1.5px] border-ink/20 bg-white p-1"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input rounded-2xl font-mono"
        />
      </div>
    </label>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border-[1.5px] px-4 text-left transition-colors ${
        value ? "border-ink bg-ink text-paper" : "border-ink/20 bg-white text-ink/70"
      }`}
    >
      <span>
        <span className="u-mono block">{label}</span>
        {hint ? <span className="u-mono block opacity-55">{hint}</span> : null}
      </span>
      <span
        className={`grid h-6 w-11 shrink-0 items-center rounded-full border-[1.5px] px-0.5 ${
          value ? "border-paper/50 bg-paper/20" : "border-ink/25"
        }`}
        aria-hidden="true"
      >
        <span
          className={`h-4 w-4 rounded-full transition-transform ${
            value ? "translate-x-5 bg-paper" : "translate-x-0 bg-ink/30"
          }`}
        />
      </span>
    </button>
  );
}

/** Lista de textos sueltos: marquee, servicios de una sede, ingredientes. */
export function StringList({
  label,
  values,
  onChange,
  placeholder,
  addLabel = "Añadir",
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div>
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>
      <div className="grid gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
              className="input rounded-2xl"
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20 text-ink/50 transition-colors hover:border-mango-deep hover:text-mango-deep"
              aria-label={`Quitar ${v || "elemento"}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="u-mono mt-2 min-h-11 rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/55 transition-colors hover:border-ink hover:text-ink"
      >
        + {addLabel}
      </button>
    </div>
  );
}

const MAX_IMAGE_KB = 400;
const MAX_SIDE = 1400;

/**
 * Media de un producto, slide o sección.
 * Las fotos se reescalan y se guardan dentro del contenido; los videos van por
 * URL, porque un video en localStorage llena la cuota en el primer archivo.
 */
export function Media({
  label,
  value,
  onChange,
  allowVideo = false,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  allowVideo?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      onChange(await downscale(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la imagen.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const isData = value?.startsWith("data:");

  return (
    <div>
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>

      {value ? (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border-[1.5px] border-ink/15 bg-white p-2">
          <Preview src={value} />
          <p className="u-mono min-w-0 flex-1 truncate normal-case tracking-[0.01em] text-ink/50">
            {isData ? "Foto subida" : value}
          </p>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="u-mono min-h-11 shrink-0 rounded-full border-[1.5px] border-ink/20 px-3 text-ink/50 transition-colors hover:border-mango-deep hover:text-mango-deep"
          >
            Quitar
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={isData ? "" : (value ?? "")}
          placeholder={allowVideo ? "Pega la URL del video o la foto" : "Pega la URL de la foto"}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
          className="input min-w-0 flex-1 rounded-2xl"
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="u-mono min-h-11 shrink-0 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Subir foto"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
      </div>

      <p className="u-mono mt-1.5 normal-case tracking-[0.01em] text-ink/35">
        Las fotos se reescalan a {MAX_SIDE} px y se guardan aquí mismo.
        {allowVideo ? " Los videos van por URL: pega el enlace del archivo .mp4." : ""}
      </p>
      {error ? <p className="u-mono mt-1 text-mango-deep">{error}</p> : null}
    </div>
  );
}

function Preview({ src }: { src: string }) {
  const isVideo = /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(src) || src.startsWith("data:video");
  if (isVideo) {
    return (
      <span className="u-mono grid h-14 w-14 shrink-0 place-items-center rounded-xl border-[1.5px] border-ink/15 bg-paper-2 text-ink/40">
        video
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      className="h-14 w-14 shrink-0 rounded-xl border-[1.5px] border-ink/15 object-cover"
    />
  );
}

/** Reescala y recomprime en el navegador; devuelve un data URL. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Eso no es una imagen. Los videos se pegan por URL."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("El navegador no pudo procesar la imagen."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Baja la calidad hasta que quepa; sin esto una foto de móvil no entra.
      let quality = 0.82;
      let out = canvas.toDataURL("image/jpeg", quality);
      while (out.length / 1024 > MAX_IMAGE_KB && quality > 0.4) {
        quality -= 0.12;
        out = canvas.toDataURL("image/jpeg", quality);
      }
      if (out.length / 1024 > MAX_IMAGE_KB) {
        reject(new Error("La foto pesa demasiado. Prueba con una más pequeña."));
        return;
      }
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la imagen."));
    };
    img.src = url;
  });
}

/** Bloque plegable para no mostrar veinte formularios abiertos a la vez. */
export function Panel({
  title,
  meta,
  children,
  defaultOpen = false,
  onRemove,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onRemove?: () => void;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-[22px] border-[1.5px] border-ink/15 bg-white"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 marker:content-['']">
        <span
          className="u-mono text-ink/35 transition-transform group-open:rotate-90"
          aria-hidden="true"
        >
          ›
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          {meta ? <span className="u-mono block text-ink/40">{meta}</span> : null}
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            className="u-mono min-h-11 shrink-0 rounded-full border-[1.5px] border-ink/20 px-3 text-ink/45 transition-colors hover:border-mango-deep hover:text-mango-deep"
          >
            Eliminar
          </button>
        ) : null}
      </summary>
      <div className="grid gap-3 border-t-[1.5px] border-ink/10 p-4">{children}</div>
    </details>
  );
}

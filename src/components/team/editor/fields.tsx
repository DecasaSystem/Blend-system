"use client";

import { useEffect, useRef, useState } from "react";
import { mediaUploadsAvailable, requestUploadTicket } from "@/actions/media";
import { isVideoUrl, mediaUrl } from "@/lib/media";

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

/** Deslizador con el valor a la vista. Para cosas que se ajustan mirando. */
export function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  suffix = "%",
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 flex items-center justify-between text-ink/45">
        <span>{label}</span>
        <span className="text-ink/70">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--color-ube)]"
      />
      {hint ? <span className="u-mono block text-ink/35">{hint}</span> : null}
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

/** Límites de Cloudinary. Avisar antes es mejor que un error a mitad de subida. */
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;

/**
 * Media de un producto, slide o sección.
 *
 * El archivo va del navegador a Cloudinary sin pasar por nuestro servidor: se
 * pide una firma, se sube directo y en la base queda sólo la URL. Antes las
 * fotos se recomprimían aquí y se guardaban enteras dentro del contenido, lo
 * que limitaba la calidad y engordaba la fila de la base con cada foto.
 *
 * No se reescala ni se recomprime nada antes de subir: se guarda el original y
 * el tamaño se decide al pintar (ver `src/lib/media.ts`). Así una foto con
 * fondo transparente lo conserva, que es justo lo que hace falta cuando
 * reemplaza a la ilustración del vaso.
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
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState<boolean | null>(null);

  useEffect(() => {
    mediaUploadsAvailable()
      .then(setCanUpload)
      .catch(() => setCanUpload(false));
  }, []);

  const busy = progress !== null;

  const pick = async (file: File) => {
    setError(null);

    const video = file.type.startsWith("video/");
    if (!video && !file.type.startsWith("image/")) {
      setError("Eso no es ni una foto ni un video.");
      return;
    }
    if (video && !allowVideo) {
      setError("Aquí sólo van fotos. El video se pone en el fondo del carrusel.");
      return;
    }

    const limit = video ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > limit * 1024 * 1024) {
      setError(
        `Pesa ${Math.round(file.size / 1024 / 1024)} MB y el máximo son ${limit} MB. ` +
          (video ? "Recórtalo o bájale la resolución." : "Prueba con una más pequeña."),
      );
      return;
    }

    setProgress(0);
    try {
      onChange(await uploadToCloudinary(file, setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  // Las fotos viejas siguen guardadas dentro del contenido; se ven igual.
  const isData = value?.startsWith("data:");

  return (
    <div>
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>

      {value ? (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border-[1.5px] border-ink/15 bg-white p-2">
          <Preview src={value} />
          <p className="u-mono min-w-0 flex-1 truncate normal-case tracking-[0.01em] text-ink/50">
            {isData ? "Foto antigua (guardada en la base)" : value}
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
        {canUpload === false ? null : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="u-mono min-h-11 shrink-0 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {busy ? `Subiendo ${progress}%` : allowVideo ? "Subir archivo" : "Subir foto"}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={allowVideo ? "image/*,video/*" : "image/*"}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
      </div>

      {busy ? (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full border-[1.5px] border-ink/15"
          role="progressbar"
          aria-valuenow={progress ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-ube transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <p className="u-mono mt-1.5 normal-case tracking-[0.01em] text-ink/35">
        {canUpload === false
          ? "Sin Cloudinary configurado: por ahora sólo se puede pegar una URL."
          : `Se guardan en Cloudinary a tamaño completo; la tienda las entrega al tamaño que necesite cada sitio. Máximo ${MAX_IMAGE_MB} MB por foto${allowVideo ? ` y ${MAX_VIDEO_MB} MB por video` : ""}.`}
      </p>
      {error ? <p className="u-mono mt-1 text-mango-deep">{error}</p> : null}
    </div>
  );
}

function Preview({ src }: { src: string }) {
  if (isVideoUrl(src)) {
    return (
      <span className="u-mono grid h-14 w-14 shrink-0 place-items-center rounded-xl border-[1.5px] border-ink/15 bg-paper-2 text-ink/40">
        video
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={mediaUrl(src, { width: 112 })}
      alt=""
      className="h-14 w-14 shrink-0 rounded-xl border-[1.5px] border-ink/15 object-cover"
    />
  );
}

/**
 * Sube el archivo a Cloudinary con la firma que da el servidor.
 *
 * XMLHttpRequest y no `fetch`, porque es lo único que informa del avance de la
 * subida: sin eso, un video de 80 MB sería un botón congelado cinco minutos.
 */
function uploadToCloudinary(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    requestUploadTicket()
      .then((ticket) => {
        if ("error" in ticket) {
          reject(new Error(ticket.error));
          return;
        }

        const form = new FormData();
        form.append("file", file);
        form.append("api_key", ticket.apiKey);
        form.append("timestamp", String(ticket.timestamp));
        form.append("signature", ticket.signature);
        form.append("folder", ticket.folder);

        const xhr = new XMLHttpRequest();
        // `auto` deja que Cloudinary decida si es imagen o video.
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${ticket.cloudName}/auto/upload`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };

        xhr.onload = () => {
          let body: { secure_url?: string; error?: { message?: string } } = {};
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            /* respuesta ilegible */
          }
          if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
            resolve(body.secure_url);
          } else {
            reject(new Error(body.error?.message ?? `Cloudinary respondió ${xhr.status}.`));
          }
        };

        xhr.onerror = () => reject(new Error("Se cortó la conexión con Cloudinary."));
        xhr.send(form);
      })
      .catch(reject);
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

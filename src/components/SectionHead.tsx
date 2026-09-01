import type { SectionCopy } from "@/lib/content";
import { mediaSrcSet, mediaUrl } from "@/lib/media";

export default function SectionHead({
  copy,
  tone = "#7B3FF2",
  right,
  invert = false,
  eyebrowSuffix,
}: {
  copy: SectionCopy;
  tone?: string;
  right?: React.ReactNode;
  invert?: boolean;
  /** Añadido al eyebrow, p. ej. la fecha de hoy. */
  eyebrowSuffix?: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p
            className={`u-mono mb-4 flex items-center gap-2.5 ${invert ? "text-paper/55" : "text-ink/45"}`}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: tone }} />
            {copy.eyebrow}
            {eyebrowSuffix ? ` · ${eyebrowSuffix}` : null}
          </p>
          <h2 className="u-display text-[clamp(2.6rem,7.5vw,5rem)]">
            {copy.title}{" "}
            {copy.accent ? (
              <span className="u-italic" style={{ color: tone }}>
                {copy.accent}
              </span>
            ) : null}
          </h2>
          {copy.body ? (
            <p
              className={`mt-5 text-lg leading-relaxed ${invert ? "text-paper/65" : "text-ink/62"}`}
            >
              {copy.body}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      {/* Imagen opcional de la sección, subida desde /equipo */}
      {copy.image ? (
        <div
          className={`mt-8 overflow-hidden rounded-[26px] border-[1.5px] ${
            invert ? "border-paper/25" : "border-ink"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(copy.image, { width: 1600 })}
            srcSet={mediaSrcSet(copy.image, 1600)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-[clamp(9rem,26vw,18rem)] w-full object-cover"
          />
        </div>
      ) : null}
    </>
  );
}

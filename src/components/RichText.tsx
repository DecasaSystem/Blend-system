import { Fragment, type ReactNode } from "react";

/**
 * El texto del asistente, con el poco formato que usa el modelo.
 *
 * El modelo escribe en Markdown aunque se le pida que no: `**Mango biche**`,
 * listas con guiones, párrafos separados por una línea en blanco. Pintado
 * tal cual, el cliente veía los asteriscos. Esto entiende sólo lo que hace
 * falta en un chat —párrafos, listas con viñetas o numeradas, negrita,
 * cursiva— y lo arma con elementos de React: nunca HTML crudo, así que lo
 * que diga el modelo no puede inyectar nada en la página.
 *
 * Los precios ($17.900) salen en la letra de ticket del sitio, como en el menú.
 * Llega a trozos mientras se escribe: un `**` sin cerrar se esconde en vez de
 * asomarse un instante.
 */

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[]; start: number };

const BULLET = /^\s*[-*•·]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim()) {
      flush();
      continue;
    }
    const b = raw.match(BULLET);
    const n = raw.match(NUMBERED);
    const h = raw.match(HEADING);
    if (b) {
      if (cur?.kind !== "ul") {
        flush();
        cur = { kind: "ul", items: [] };
      }
      (cur as { items: string[] }).items.push(b[1]);
    } else if (n) {
      if (cur?.kind !== "ol") {
        flush();
        cur = { kind: "ol", items: [], start: Number(n[1]) };
      }
      (cur as { items: string[] }).items.push(n[2]);
    } else {
      // Un título de Markdown en un chat sobra: va como una línea en negrita.
      const line = h ? `**${h[1].replace(/\*\*/g, "")}**` : raw.trim();
      if (cur?.kind !== "p") {
        flush();
        cur = { kind: "p", lines: [] };
      }
      (cur as { lines: string[] }).lines.push(line);
    }
  }
  flush();
  return blocks;
}

// Negrita, cursiva y precios. El orden importa: `**` antes que `*`.
const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_|\$\s?\d{1,3}(?:[.,]\d{3})+)/g;

type LinkFor = (bold: string) => (() => void) | null;

function inline(text: string, key: string, linkFor?: LinkFor): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      const inner = part.slice(2, -2);
      const go = linkFor?.(inner);
      if (go) {
        // El nombre de una bebida: abre su ficha. Se ve como negrita con
        // subrayado de color, para que se note que se puede tocar.
        return (
          <button
            key={k}
            type="button"
            onClick={go}
            className="inline font-semibold text-ink underline decoration-mango decoration-2 underline-offset-[3px] transition-colors hover:text-mango-deep"
          >
            {inner}
          </button>
        );
      }
      return (
        <strong key={k} className="font-semibold text-ink">
          {inline(part.slice(2, -2), k)}
        </strong>
      );
    }
    if (
      part.length > 2 &&
      ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
    ) {
      return <em key={k}>{inline(part.slice(1, -1), k, linkFor)}</em>;
    }
    if (part.startsWith("$")) {
      return (
        <span key={k} className="u-price whitespace-nowrap text-[0.92em] text-ink">
          {part.replace(/\$\s?/, "$ ")}
        </span>
      );
    }
    // Lo que quede de un `**` a medio escribir no se muestra.
    return <Fragment key={k}>{part.replace(/\*\*|__/g, "")}</Fragment>;
  });
}

export default function RichText({ text, linkFor }: { text: string; linkFor?: LinkFor }) {
  const blocks = parseBlocks(text);
  return (
    <div className="grid gap-2.5">
      {blocks.map((b, i) => {
        const key = `b${i}`;
        if (b.kind === "p") {
          return (
            <p key={key}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  {inline(l, `${key}-${j}`, linkFor)}
                </Fragment>
              ))}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={key} className="grid gap-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5">
                  <span
                    className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-mango"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{inline(it, `${key}-${j}`, linkFor)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={key} className="grid gap-1.5" start={b.start}>
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span
                  className="u-mono mt-[0.2em] grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ube/12 px-1 text-[0.62rem] text-ube"
                  aria-hidden="true"
                >
                  {b.start + j}
                </span>
                <span className="min-w-0">{inline(it, `${key}-${j}`, linkFor)}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

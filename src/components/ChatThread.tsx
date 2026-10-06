"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, Location, Sender } from "@/actions/chat";
import { formatClock } from "@/lib/orders";
import RichText from "./RichText";

/**
 * Un hilo de chat: los mensajes y la caja para escribir.
 *
 * Lo usan la burbuja de la tienda (cliente ↔ barra y cliente ↔ repartidor) y
 * la pantalla del repartidor. Quien lo monta decide qué remitentes son «yo»,
 * las respuestas rápidas que ofrece, y si se puede mandar la ubicación.
 *
 * La ubicación se pide al navegador en el momento de tocar el botón y viaja
 * como un punto en el mensaje; el otro lado la ve como un enlace al mapa. No
 * se sigue a nadie en tiempo real: es «aquí estoy», una vez, a voluntad.
 */
export default function ChatThread({
  messages,
  mine,
  onSend,
  quickReplies = [],
  allowLocation = false,
  placeholder = "Escribe aquí…",
  empty,
  dark = false,
  rich = false,
  avatar,
  suggestions = [],
  linkFor,
}: {
  messages: ChatMessage[] | null;
  /** Qué remitentes se pintan a la derecha, como propios. */
  mine: Sender[];
  onSend: (body: string, location?: Location | null) => Promise<string | null>;
  quickReplies?: string[];
  allowLocation?: boolean;
  placeholder?: string;
  empty?: React.ReactNode;
  dark?: boolean;
  /** Los mensajes del otro lado traen formato (el asistente): se pintan con `RichText`. */
  rich?: boolean;
  /** Cara junto a los mensajes del otro lado. Con ella sobra repetir su nombre. */
  avatar?: React.ReactNode;
  /** Con el hilo vacío: preguntas para empezar, en tarjetas bajo la bienvenida. */
  suggestions?: string[];
  /** Con `rich`: qué negritas son enlaces (p. ej. el nombre de una bebida abre su ficha). */
  linkFor?: (bold: string) => (() => void) | null;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  /** Si quien lee está al fondo. Si subió a releer algo, no se le arrastra abajo. */
  const pinned = useRef(true);

  // Bajar dentro del hilo, no con `scrollIntoView`: ese también movía la
  // página entera en el teléfono cada vez que llegaba un trozo de respuesta.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Hilo vacío: la bienvenida se lee desde arriba.
    if (!messages?.length) el.scrollTop = 0;
    else if (pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // La caja crece con lo que se escribe, hasta el tope de `max-h-32`.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const send = async (text: string, location?: Location | null) => {
    if (sending) return;
    if (!text.trim() && !location) return;
    setSending(true);
    setError(null);
    pinned.current = true;
    // La caja se vacía al enviar, no al terminar la respuesta (el asistente
    // tarda lo que tarde en escribir). Si falla, el texto vuelve.
    const kept = draft;
    setDraft("");
    const err = await onSend(text.trim(), location ?? null);
    setSending(false);
    if (err) {
      setError(err);
      setDraft(kept);
    }
  };

  const shareLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Este aparato no da la ubicación.");
      return;
    }
    setSending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSending(false);
        send("", { lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setSending(false);
        setError("No se pudo leer la ubicación. Revisa el permiso del navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className={`flex-1 overflow-y-auto overscroll-contain px-4 py-4 ${dark ? "" : "bg-paper"}`}
      >
        {messages === null ? (
          <p className="u-mono py-8 text-center text-ink/40">Cargando…</p>
        ) : messages.length === 0 && (empty || suggestions.length > 0) ? (
          <div className="grid gap-3">
            {empty ? (
              <div className="rounded-2xl border-[1.5px] border-ink/12 bg-white px-4 py-3 text-[0.95rem] leading-relaxed text-ink/65">
                {empty}
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="grid gap-2">
                <p className="u-mono px-1 text-ink/40">Puedes empezar por</p>
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={sending}
                    onClick={() => send(q)}
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-2.5 text-left text-[0.92rem] text-ink transition-[border-color,transform,box-shadow] hover:-translate-y-px hover:border-ink hover:shadow-[2px_3px_0_0_var(--color-ink)] disabled:opacity-50"
                  >
                    <span>{q}</span>
                    <span className="text-mango transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                      →
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="grid gap-3">
            {messages.map((m, idx) => {
              const own = mine.includes(m.sender);
              const next = messages[idx + 1];
              // La cara y la hora van sólo en el último de una racha seguida del mismo lado.
              const last = !next || mine.includes(next.sender) !== own;
              return (
                <Bubble
                  key={m.id}
                  m={m}
                  own={own}
                  rich={rich && !own}
                  linkFor={linkFor}
                  avatar={own ? undefined : avatar}
                  showMeta={last}
                />
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="border-t-[1.5px] border-ink/12 bg-white p-3"
      >
        {quickReplies.length > 0 ? (
          <div className="rail -mx-3 mb-2 px-3 pb-1">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => send(q)}
                className="u-mono min-h-9 whitespace-nowrap rounded-full border-[1.5px] border-ink/20 bg-paper px-3 text-ink/70 transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="u-mono mb-2 text-mango-deep" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          {allowLocation ? (
            <button
              type="button"
              onClick={shareLocation}
              disabled={sending}
              aria-label="Enviar mi ubicación"
              title="Enviar mi ubicación"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/25 bg-paper text-lg disabled:opacity-40"
            >
              📍
            </button>
          ) : null}
          <textarea
            ref={field}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={placeholder}
            aria-label="Mensaje"
            className="input max-h-32 min-h-11 flex-1 resize-none rounded-2xl py-2.5"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Enviar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-mango text-white disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({
  m,
  own,
  rich,
  avatar,
  showMeta,
  linkFor,
}: {
  m: ChatMessage;
  own: boolean;
  rich: boolean;
  avatar?: React.ReactNode;
  showMeta: boolean;
  linkFor?: (bold: string) => (() => void) | null;
}) {
  const maps = m.location
    ? `https://www.google.com/maps/search/?api=1&query=${m.location.lat},${m.location.lng}`
    : null;
  // Un mensaje del otro lado sin texto todavía es una respuesta que se está escribiendo.
  const typing = !own && !m.body && !maps;
  return (
    <li className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
      {avatar ? (
        // Siempre ocupa su sitio, aunque sólo se vea en el último de la racha:
        // así las burbujas seguidas quedan alineadas.
        <span className={`mb-5 shrink-0 ${showMeta ? "" : "invisible"}`}>{avatar}</span>
      ) : null}
      <div className={`flex min-w-0 max-w-[85%] flex-col ${own ? "items-end" : "items-start"}`}>
        <div
          className={`min-w-0 break-words rounded-[20px] px-3.5 py-2.5 text-[0.95rem] leading-relaxed ${
            rich ? "" : "whitespace-pre-wrap"
          } ${
            own
              ? "rounded-br-md bg-ink text-paper"
              : "rounded-bl-md border-[1.5px] border-ink/12 bg-white text-ink/85 shadow-[0_1px_0_0_rgba(27,11,46,0.06)]"
          }`}
        >
          {typing ? (
            <TypingDots />
          ) : rich ? (
            <RichText text={m.body} linkFor={linkFor} />
          ) : (
            m.body
          )}
          {maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noopener"
              className={`u-mono mt-2 block rounded-xl border-[1.5px] px-3 py-2 text-center normal-case tracking-[0.01em] ${
                own ? "border-paper/30 text-paper" : "border-ink/20 text-ube"
              }`}
            >
              Ver en el mapa →
            </a>
          ) : null}
        </div>
        {showMeta ? (
          <span className="u-mono mt-1 px-1 text-ink/35">
            {own || avatar ? "" : `${m.senderName} · `}
            {typing ? "escribiendo…" : formatClock(m.createdAt)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Tres puntos que laten mientras llega la respuesta. */
function TypingDots() {
  return (
    <span className="flex h-6 items-center gap-1 px-0.5" role="status" aria-label="Escribiendo">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot h-2 w-2 rounded-full bg-ink/35"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12 20 4l-4 16-4-7-8-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

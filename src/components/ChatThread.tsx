"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Location, Sender } from "@/actions/chat";
import { formatClock } from "@/lib/orders";

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
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async (text: string, location?: Location | null) => {
    if (sending) return;
    if (!text.trim() && !location) return;
    setSending(true);
    setError(null);
    const err = await onSend(text.trim(), location ?? null);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setDraft("");
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
      <div className={`flex-1 overflow-y-auto px-4 py-4 ${dark ? "" : "bg-paper"}`}>
        {messages === null ? (
          <p className="u-mono py-8 text-center text-ink/40">Cargando…</p>
        ) : messages.length === 0 && empty ? (
          <div className="rounded-2xl border-[1.5px] border-ink/12 bg-white px-4 py-3 text-[0.95rem] leading-relaxed text-ink/65">
            {empty}
          </div>
        ) : (
          <ul className="grid gap-2">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} own={mine.includes(m.sender)} />
            ))}
          </ul>
        )}
        <div ref={bottom} />
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

function Bubble({ m, own }: { m: ChatMessage; own: boolean }) {
  const maps = m.location
    ? `https://www.google.com/maps/search/?api=1&query=${m.location.lat},${m.location.lng}`
    : null;
  return (
    <li className={`flex flex-col ${own ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed ${
          own ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border-[1.5px] border-ink/12 bg-white text-ink"
        }`}
      >
        {m.body}
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
      <span className="u-mono mt-1 text-ink/35">
        {own ? "" : `${m.senderName} · `}
        {formatClock(m.createdAt)}
      </span>
    </li>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12 20 4l-4 16-4-7-8-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

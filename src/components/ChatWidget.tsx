"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { myChat, myChatUnread, sendMyMessage, type ChatMessage } from "@/actions/chat";
import { formatClock } from "@/lib/orders";

/**
 * La burbuja de chat de la tienda.
 *
 * Abajo a la derecha, siempre a mano. Abierta, es un hilo con la barra:
 * el cliente escribe, alguien del equipo contesta desde /equipo → Chat, y
 * la ventana se actualiza sola cada pocos segundos. Cerrada, sólo pregunta
 * de vez en cuando si hay respuestas nuevas y enseña el número.
 *
 * Hace falta cuenta: sin ella no hay a quién responderle después. Al que no
 * tiene, se le ofrece entrar o llamar.
 */

const OPEN_MS = 4000;
const CLOSED_MS = 30000;

export default function ChatWidget({
  signedIn,
  prefill,
}: {
  signedIn: boolean;
  /** Texto con el que arranca el mensaje: «Sobre mi pedido B-1043: ». */
  prefill?: string;
}) {
  const { brand, stores } = useSite();
  const { count, open: cartOpen, sheet } = useCart();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState(prefill ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const hours = stores[0]?.hours;

  const load = useCallback(async () => {
    const res = await myChat(true);
    if (res) {
      // Un sondeo que salió antes de enviar puede volver después: nunca deja
      // menos mensajes de los que ya se ven.
      setMessages((prev) => (prev && res.messages.length < prev.length ? prev : res.messages));
      setUnread(0);
    }
  }, []);

  // Abierto: hilo al día. Cerrado: sólo el contador, con calma.
  useEffect(() => {
    if (!signedIn) return;
    if (open) {
      load();
      const t = setInterval(load, OPEN_MS);
      return () => clearInterval(t);
    }
    const tick = () => myChatUnread().then(setUnread).catch(() => {});
    tick();
    const t = setInterval(tick, CLOSED_MS);
    return () => clearInterval(t);
  }, [open, signedIn, load]);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const res = await sendMyMessage(text);
    setSending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setDraft("");
    setMessages((m) => [...(m ?? []), res.message]);
    load();
  };

  // Con el carrito o la hoja abiertos no compite; en móvil, con la barra del
  // pedido abajo, sube para no taparla.
  const hidden = cartOpen || sheet !== null;
  const lift = count > 0 ? "bottom-[5.5rem] lg:bottom-6" : "bottom-4 lg:bottom-6";

  return (
    <div
      className={`fixed right-4 z-[70] transition-all duration-300 lg:right-6 ${lift} ${
        hidden ? "pointer-events-none translate-y-4 opacity-0" : ""
      }`}
    >
      {open ? (
        <section
          className="mb-3 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-[26px] border-[1.5px] border-ink bg-paper shadow-[6px_8px_0_0_var(--color-ink)]"
          style={{ height: "min(32rem, calc(100dvh - 8rem))" }}
          aria-label="Chat con la barra"
        >
          <header className="flex items-center gap-3 border-b-[1.5px] border-ink bg-ink px-4 py-3 text-paper">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-mango text-white" aria-hidden="true">
              <ChatIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">La barra de {brand.name}</p>
              <p className="u-mono text-paper/55">
                {hours ? `Horario ${hours}` : "Te respondemos en un momento"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar el chat"
              className="grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-paper/30 text-paper"
            >
              ✕
            </button>
          </header>

          {!signedIn ? (
            <div className="flex flex-1 flex-col justify-center gap-4 px-5 py-6 text-center">
              <p className="u-display text-2xl leading-tight">¿Tienes una pregunta?</p>
              <p className="text-ink/65">
                Entra a tu cuenta para escribirnos: así te podemos responder aunque cierres la
                página, y vemos tus pedidos para ayudarte mejor.
              </p>
              <div className="grid gap-2">
                <Link href="/cuenta/entrar" className="btn btn-mango">
                  Entrar o crear cuenta
                </Link>
                <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="btn btn-paper">
                  Llamar a la barra
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages === null ? (
                  <p className="u-mono py-8 text-center text-ink/40">Cargando…</p>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border-[1.5px] border-ink/12 bg-white px-4 py-3 text-[0.95rem] leading-relaxed text-ink/65">
                    Hola 👋 Escríbenos lo que necesites: una duda del menú, algo de tu pedido, una
                    alergia. Te contesta alguien de la barra.
                  </div>
                ) : (
                  <ul className="grid gap-2">
                    {messages.map((m) => (
                      <Bubble key={m.id} m={m} mine={m.sender === "customer"} />
                    ))}
                  </ul>
                )}
                <div ref={bottom} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="border-t-[1.5px] border-ink/12 bg-white p-3"
              >
                {error ? (
                  <p className="u-mono mb-2 text-mango-deep" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="Escribe aquí…"
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
            </>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Cerrar el chat" : "Abrir el chat con la barra"}
        className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-ink bg-ink text-paper shadow-[0_10px_30px_rgba(27,11,46,0.35)] transition-transform active:scale-95"
      >
        {open ? <span className="text-xl">✕</span> : <ChatIcon />}
        {!open && unread > 0 ? (
          <span className="u-mono absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-[1.5px] border-paper bg-mango px-1.5 text-[0.6rem] text-white">
            {unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed ${
          mine ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border-[1.5px] border-ink/12 bg-white text-ink"
        }`}
      >
        {m.body}
      </div>
      <span className="u-mono mt-1 text-ink/35">
        {mine ? "" : `${m.senderName} · `}
        {formatClock(m.createdAt)}
      </span>
    </li>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.4 3.3A.6.6 0 0 1 4.6 19V6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 12.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12 20 4l-4 16-4-7-8-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

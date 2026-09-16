"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CupLoader } from "@/components/CupLoader";
import {
  chatMessages,
  listChats,
  replyChat,
  type ChatMessage,
  type ChatSummary,
} from "@/actions/chat";
import { formatClock } from "@/lib/orders";

/**
 * El chat visto desde la barra.
 *
 * A la izquierda las conversaciones, las que esperan respuesta primero; a la
 * derecha el hilo abierto con su caja para contestar. En celular, una cosa a
 * la vez. Contesta quien esté: cada respuesta lleva el nombre de quien la
 * escribió, y el cliente lo ve.
 *
 * Se refresca sola cada pocos segundos, como el tablero.
 */

const REFRESH_MS = 4000;

export default function ChatPanel() {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      setChats(await listChats());
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const rows = await chatMessages(id, true);
      // Igual que en la tienda: un sondeo viejo no borra lo recién enviado.
      setThread((prev) => (prev && rows.length < prev.length ? prev : rows));
    } catch {
      /* idem */
    }
  }, []);

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, REFRESH_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!activeId) return;
    setThread(null);
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), REFRESH_MS);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  const active = chats?.find((c) => c.id === activeId) ?? null;

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setError(null);
    const res = await replyChat(activeId, text);
    setSending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setDraft("");
    setThread((t) => [...(t ?? []), res.message]);
    loadThread(activeId);
    loadList();
  };

  // Primero los que esperan respuesta, luego por recencia.
  const sorted = (chats ?? [])
    .slice()
    .sort((a, b) => Number(b.awaiting) - Number(a.awaiting) || b.lastMessageAt - a.lastMessageAt);

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="u-display text-3xl">Chat con clientes</h2>
        <p className="u-mono ml-auto text-ink/45">
          {chats ? `${chats.filter((c) => c.awaiting).length} esperando respuesta` : ""}
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Lista */}
        <div className={`${activeId ? "hidden lg:block" : ""}`}>
          {chats === null ? (
            <CupLoader size={56} label="Cargando…" className="py-10" />
          ) : sorted.length === 0 ? (
            <p className="u-mono rounded-2xl border-[1.5px] border-dashed border-ink/15 px-4 py-10 text-center normal-case tracking-[0.01em] text-ink/40">
              Nadie ha escrito todavía. Los clientes con cuenta pueden hacerlo desde la burbuja de
              la tienda.
            </p>
          ) : (
            <ul className="grid gap-2">
              {sorted.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`w-full rounded-2xl border-[1.5px] p-3.5 text-left transition-colors ${
                      c.id === activeId
                        ? "border-ink bg-ink text-paper"
                        : c.awaiting
                          ? "border-mango bg-white hover:border-ink"
                          : "border-ink/15 bg-white hover:border-ink"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{c.customerName}</p>
                      <span className={`u-mono shrink-0 ${c.id === activeId ? "text-paper/50" : "text-ink/40"}`}>
                        {formatClock(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className={`min-w-0 flex-1 truncate text-[0.9rem] ${c.id === activeId ? "text-paper/70" : "text-ink/60"}`}>
                        {c.preview || "…"}
                      </p>
                      {c.unread > 0 ? (
                        <span className="u-mono grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-mango px-1.5 text-[0.6rem] text-white">
                          {c.unread}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hilo */}
        <div className={`${activeId ? "" : "hidden lg:block"}`}>
          {!active ? (
            <p className="u-mono hidden rounded-[22px] border-[1.5px] border-dashed border-ink/15 px-4 py-16 text-center normal-case tracking-[0.01em] text-ink/40 lg:block">
              Elige una conversación.
            </p>
          ) : (
            <section
              className="flex flex-col overflow-hidden rounded-[22px] border-[1.5px] border-ink bg-white"
              style={{ height: "min(40rem, calc(100dvh - 12rem))" }}
            >
              <header className="flex items-center gap-3 border-b-[1.5px] border-ink/12 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="u-mono grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20 lg:hidden"
                  aria-label="Volver a la lista"
                >
                  ←
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-tight">{active.customerName}</p>
                  <p className="u-mono truncate normal-case tracking-[0.01em] text-ink/45">
                    {active.customerEmail}
                    {active.customerPhone ? ` · ${active.customerPhone}` : ""}
                  </p>
                </div>
                {active.customerPhone ? (
                  <a
                    href={`tel:${active.customerPhone.replace(/\s/g, "")}`}
                    className="u-mono min-h-10 shrink-0 rounded-full border-[1.5px] border-ink/20 px-3.5 leading-10 text-ink/60"
                  >
                    Llamar
                  </a>
                ) : null}
              </header>

              <div className="flex-1 overflow-y-auto bg-paper px-4 py-4">
                {thread === null ? (
                  <CupLoader size={48} label="Cargando el hilo…" className="py-8" />
                ) : (
                  <ul className="grid gap-2">
                    {thread.map((m) => (
                      <li
                        key={m.id}
                        className={`flex flex-col ${m.sender === "staff" ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed ${
                            m.sender === "staff"
                              ? "rounded-br-md bg-ink text-paper"
                              : "rounded-bl-md border-[1.5px] border-ink/12 bg-white"
                          }`}
                        >
                          {m.body}
                        </div>
                        <span className="u-mono mt-1 text-ink/35">
                          {m.senderName} · {formatClock(m.createdAt)}
                        </span>
                      </li>
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
                className="border-t-[1.5px] border-ink/12 p-3"
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
                    placeholder={`Responder a ${active.customerName.split(" ")[0]}… (Enter envía, Shift+Enter salta de línea)`}
                    aria-label="Respuesta"
                    className="input max-h-40 min-h-11 flex-1 resize-none rounded-2xl py-2.5"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="btn btn-sm btn-mango shrink-0 disabled:opacity-40"
                  >
                    Enviar
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

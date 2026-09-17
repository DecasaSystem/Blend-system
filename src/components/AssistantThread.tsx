"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ChatThread from "./ChatThread";
import { useCart } from "./CartProvider";
import { useAssistantActions } from "./useAssistantActions";
import type { ChatMessage } from "@/actions/chat";
import type { AssistantAction } from "@/lib/assistant";

/**
 * La conversación con el asistente.
 *
 * Reusa el hilo del chat humano para que se vea igual; lo distinto es de
 * dónde salen las respuestas: de /api/asistente, a trozos, y con acciones
 * que se ejecutan aquí mismo (bajar al menú, abrir una ficha, agregar al
 * carrito). La conversación vive en sessionStorage: sobrevive a que el
 * asistente mande al cliente a otra página y muere al cerrar la pestaña.
 */

const STORAGE_KEY = "blend.asistente.hilo";
const MAX_KEPT = 30;

const QUICK = ["¿Qué me recomiendas?", "¿Dónde están?", "¿Cuánto vale el domicilio?"];

const ASSISTANT = "Asistente";

function load(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AssistantThread({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const { lines } = useCart();
  const run = useAssistantActions();
  // Vacío en el servidor y en el primer render: lo guardado entra en el efecto.
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(load());
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!messages) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_KEPT)));
    } catch {
      // Sin sitio o sin permiso: la conversación sólo dura lo que dura la página.
    }
  }, [messages]);

  const send = async (body: string): Promise<string | null> => {
    const prior = messages ?? [];
    const user: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "customer",
      senderName: "Tú",
      body,
      location: null,
      createdAt: Date.now(),
    };
    const replyId = `a-${Date.now()}`;
    const reply: ChatMessage = {
      id: replyId,
      sender: "staff",
      senderName: ASSISTANT,
      body: "",
      location: null,
      createdAt: Date.now(),
    };
    setMessages([...prior, user, reply]);

    const patch = (fn: (text: string) => string) =>
      setMessages((ms) => (ms ?? []).map((m) => (m.id === replyId ? { ...m, body: fn(m.body) } : m)));

    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: [...prior, user]
            .filter((m) => m.body.trim())
            .map((m) => ({ role: m.sender === "customer" ? "user" : "assistant", content: m.body })),
          page: pathname,
          cart: lines.map((l) => ({ name: l.name, qty: l.qty })),
          signedIn,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        patch(() => data?.error ?? "No pude responder ahora mismo. Inténtalo otra vez.");
        return null;
      }

      // Líneas JSON según van llegando (ver la ruta).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let got = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const rows = buffer.split("\n");
        buffer = rows.pop() ?? "";
        for (const row of rows) {
          if (!row.trim()) continue;
          let ev: { t: string; v?: unknown };
          try {
            ev = JSON.parse(row);
          } catch {
            continue;
          }
          if (ev.t === "delta" && typeof ev.v === "string") {
            got = true;
            const delta = ev.v;
            patch((text) => text + delta);
          } else if (ev.t === "action" && ev.v) {
            run(ev.v as AssistantAction);
          } else if (ev.t === "error" && typeof ev.v === "string") {
            const msg = ev.v;
            patch((text) => (text ? `${text}\n\n${msg}` : msg));
          }
        }
      }
      if (!got) patch((text) => text || "Hecho.");
      return null;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      patch(() => "Sin conexión. Inténtalo otra vez.");
      return null;
    }
  };

  return (
    <ChatThread
      messages={messages}
      mine={["customer"]}
      onSend={send}
      quickReplies={messages && messages.length === 0 ? QUICK : []}
      placeholder="Pregúntame lo que quieras…"
      empty={
        <>
          Hola 👋 Soy el asistente de la tienda. Te ayudo a elegir, te digo precios, horarios y
          cómo pedir, y te llevo a lo que busques.{" "}
          {signedIn
            ? "Si necesitas a una persona, la pestaña «La barra» es con ellos."
            : "Si necesitas a una persona, entra a tu cuenta y escríbele a la barra."}
        </>
      }
    />
  );
}

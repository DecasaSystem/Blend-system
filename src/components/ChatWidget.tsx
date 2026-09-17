"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import ChatThread from "./ChatThread";
import AssistantThread from "./AssistantThread";
import AssistantFace from "./AssistantFace";
import PushToggle from "./PushToggle";
import { REOPEN_KEY, usePendingAssistantAction } from "./useAssistantActions";
import {
  deliveryChat,
  myChat,
  myThreads,
  sendDeliveryMessage,
  sendMyMessage,
  type ChatMessage,
  type DeliveryThread,
  type Location,
} from "@/actions/chat";

/**
 * La burbuja de chat de la tienda.
 *
 * Abajo a la derecha, siempre a mano. Abierta tiene una pestaña por hilo:
 * «Asistente» (responde al instante, con IA, y puede mover la página),
 * «La barra» (una persona), y una por cada domicilio en marcha con su
 * repartidor. Los hilos humanos se actualizan solos cada pocos segundos;
 * cerrada, sólo pregunta de vez en cuando cuántos mensajes hay sin leer.
 *
 * `?chat=store` o `?chat=B-1043` en la URL la abre directamente en ese hilo:
 * es a donde llevan los avisos push.
 *
 * El asistente funciona sin cuenta. Para escribirle a la barra sí hace
 * falta: sin ella no hay a quién responderle después. Al que no tiene, se
 * le ofrece entrar o llamar.
 */

const OPEN_MS = 4000;
const CLOSED_MS = 30000;
/** El «¿te ayudo?» junto a la burbuja: una vez por sesión, y sólo si no la abren. */
const TEASE_KEY = "blend.chat.tease";
const TEASE_AFTER_MS = 2500;

type ThreadId = "asistente" | "store" | string;

const QUICK_CUSTOMER = ["Ya bajo", "Timbra, por favor", "Llámame cuando llegues", "Déjalo en portería"];

export default function ChatWidget({ signedIn }: { signedIn: boolean }) {
  const { brand, stores } = useSite();
  const { count, open: cartOpen, sheet } = useCart();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadId>("asistente");
  const [storeMessages, setStoreMessages] = useState<ChatMessage[] | null>(null);
  const [deliveryMessages, setDeliveryMessages] = useState<ChatMessage[] | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryThread[]>([]);
  const [storeUnread, setStoreUnread] = useState(0);
  const [tease, setTease] = useState(false);
  const hours = stores[0]?.hours;

  // La invitación aparece a los pocos segundos la primera vez en la sesión
  // y se va sola al abrir el chat (o al tocar su ✕).
  useEffect(() => {
    if (open) {
      setTease(false);
      return;
    }
    try {
      if (sessionStorage.getItem(TEASE_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setTease(true), TEASE_AFTER_MS);
    return () => clearTimeout(t);
  }, [open]);
  const dismissTease = () => {
    setTease(false);
    try {
      sessionStorage.setItem(TEASE_KEY, "1");
    } catch {
      // Sin sessionStorage volverá a salir en la próxima página; no pasa nada.
    }
  };

  const totalUnread = storeUnread + deliveries.reduce((n, d) => n + d.unread, 0);

  // Qué hilos hay y cuánto hay sin leer en cada uno.
  const loadThreads = useCallback(async () => {
    const t = await myThreads().catch(() => null);
    if (!t) return;
    setStoreUnread(t.storeUnread);
    setDeliveries(t.deliveries);
  }, []);

  const loadOpen = useCallback(async (id: ThreadId) => {
    if (id === "store") {
      const res = await myChat(true).catch(() => null);
      if (res) {
        setStoreMessages((prev) => (prev && res.messages.length < prev.length ? prev : res.messages));
        setStoreUnread(0);
      }
    } else {
      const res = await deliveryChat(id, true).catch(() => null);
      if (res) {
        setDeliveryMessages((prev) => (prev && res.messages.length < prev.length ? prev : res.messages));
        setDeliveries((ds) => ds.map((d) => (d.orderId === id ? { ...d, unread: 0 } : d)));
      }
    }
  }, []);

  // Si el asistente mandó al cliente a otra página o a una ficha en la
  // portada, aquí se termina de hacer y el chat vuelve a abrirse.
  usePendingAssistantAction();
  useEffect(() => {
    try {
      if (sessionStorage.getItem(REOPEN_KEY)) {
        sessionStorage.removeItem(REOPEN_KEY);
        setThread("asistente");
        setOpen(true);
      }
    } catch {
      // Sin sessionStorage no hay nada que reabrir.
    }
  }, []);

  // Enlace profundo desde un aviso: abrir en el hilo que toca.
  useEffect(() => {
    if (!signedIn) return;
    const want = new URLSearchParams(window.location.search).get("chat");
    if (!want) return;
    setThread(want === "store" ? "store" : want);
    setOpen(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    loadThreads();
    const t = setInterval(loadThreads, open ? OPEN_MS : CLOSED_MS);
    return () => clearInterval(t);
  }, [signedIn, open, loadThreads]);

  useEffect(() => {
    if (!signedIn || !open || thread === "asistente") return;
    setDeliveryMessages(null);
    loadOpen(thread);
    const t = setInterval(() => loadOpen(thread), OPEN_MS);
    return () => clearInterval(t);
  }, [signedIn, open, thread, loadOpen]);

  const sendStore = async (body: string) => {
    const res = await sendMyMessage(body);
    if ("error" in res) return res.error;
    setStoreMessages((m) => [...(m ?? []), res.message]);
    loadOpen("store");
    return null;
  };

  const sendDelivery = async (body: string, location?: Location | null) => {
    if (thread === "store") return null;
    const res = await sendDeliveryMessage(thread, body, location);
    if ("error" in res) return res.error;
    setDeliveryMessages((m) => [...(m ?? []), res.message]);
    loadOpen(thread);
    return null;
  };

  const active = deliveries.find((d) => d.orderId === thread) ?? null;
  const asistente = thread === "asistente";

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
          style={{ height: "min(34rem, calc(100dvh - 8rem))" }}
          aria-label={asistente ? "Asistente de la tienda" : "Chat con la barra"}
        >
          <header className="border-b-[1.5px] border-ink bg-ink px-4 py-3 text-paper">
            <div className="flex items-center gap-3">
              {asistente ? (
                <AssistantFace size={36} className="border-[1.5px] border-paper/40" />
              ) : (
                <span
                  className="grid h-9 w-9 place-items-center rounded-full bg-mango text-white"
                  aria-hidden="true"
                >
                  {active ? "🛵" : <ChatIcon />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">
                  {asistente
                    ? `Asistente de ${brand.name}`
                    : active
                      ? `${active.courierName ?? "Tu repartidor"} · ${active.orderId}`
                      : `La barra de ${brand.name}`}
                </p>
                <p className="u-mono text-paper/55">
                  {asistente
                    ? "Con IA · al instante"
                    : active
                      ? active.outAt
                        ? "En camino"
                        : "Preparando tu pedido"
                      : hours
                        ? `Horario ${hours}`
                        : "Te respondemos en un momento"}
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
            </div>
            <div className="rail -mx-1 mt-3 px-1 pb-0.5" role="tablist">
              <Tab
                active={asistente}
                onClick={() => setThread("asistente")}
                unread={0}
                label="✦ Asistente"
              />
              <Tab
                  active={thread === "store"}
                  onClick={() => setThread("store")}
                unread={storeUnread}
                label="La barra"
              />
              {deliveries.map((d) => (
                <Tab
                  key={d.orderId}
                  active={thread === d.orderId}
                  onClick={() => setThread(d.orderId)}
                  unread={d.unread}
                  label={`🛵 ${d.orderId}`}
                />
              ))}
            </div>
          </header>

          {asistente ? (
            <AssistantThread signedIn={signedIn} />
          ) : !signedIn ? (
            <div className="flex flex-1 flex-col justify-center gap-4 px-5 py-6 text-center">
              <p className="u-display text-2xl leading-tight">¿Tienes una pregunta?</p>
              <p className="text-ink/65">
                Entra a tu cuenta para escribirnos: así te podemos responder aunque cierres la
                página, y vemos tus pedidos para ayudarte mejor.
              </p>
              <div className="grid gap-2">
                <Link href="/cuenta/entrar?next=%2F%3Fchat%3Dstore" className="btn btn-mango">
                  Entrar o crear cuenta
                </Link>
                <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="btn btn-paper">
                  Llamar a la barra
                </a>
              </div>
            </div>
          ) : thread === "store" || !active ? (
            <>
              <div className="border-b-[1.5px] border-ink/10 bg-white px-4 py-2">
                <PushToggle compact what="cuando te respondan o tu pedido avance" />
              </div>
              <ChatThread
                messages={storeMessages}
                mine={["customer"]}
                onSend={sendStore}
                empty={
                  <>
                    Hola 👋 Escríbenos lo que necesites: una duda del menú, algo de tu pedido, una
                    alergia. Te contesta alguien de la barra.
                  </>
                }
              />
            </>
          ) : (
            <ChatThread
              messages={deliveryMessages}
              mine={["customer"]}
              onSend={sendDelivery}
              quickReplies={QUICK_CUSTOMER}
              allowLocation
              placeholder="Escríbele aquí…"
              empty={
                <>
                  Este es tu chat con {active.courierName ?? "el repartidor"} para el pedido{" "}
                  <b>{active.orderId}</b>. Si necesita ayuda para encontrarte, aquí te escribe; con
                  📍 le mandas tu ubicación exacta.
                </>
              }
            />
          )}
        </section>
      ) : null}

      <div className="flex items-center justify-end gap-2.5">
        {tease && !open ? (
          <div
            role="status"
            className="flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-paper py-1.5 pl-3.5 pr-1.5 shadow-[3px_4px_0_0_var(--color-ink)]"
          >
            <button
              type="button"
              onClick={() => {
                dismissTease();
                setThread("asistente");
                setOpen(true);
              }}
              className="text-[0.9rem] font-medium leading-none text-ink"
            >
              ¿Te ayudo a elegir?
            </button>
            <button
              type="button"
              onClick={dismissTease}
              aria-label="Cerrar la invitación"
              className="grid h-7 w-7 place-items-center rounded-full text-ink/45 hover:text-ink"
            >
              ✕
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (!open) dismissTease();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={open ? "Cerrar el chat" : "Abrir el chat"}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-ink shadow-[4px_5px_0_0_var(--color-ink)] transition-transform active:scale-95 ${
            open ? "bg-paper text-ink" : "bg-mango text-white"
          }`}
        >
          {open ? <span className="text-xl">✕</span> : <AssistantFace size={54} />}
          {!open && totalUnread > 0 ? (
            <span className="u-mono absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-[1.5px] border-paper bg-ink px-1.5 text-[0.6rem] text-paper">
              {totalUnread}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  unread,
  label,
}: {
  active: boolean;
  onClick: () => void;
  unread: number;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`u-mono flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 ${
        active ? "border-paper bg-paper text-ink" : "border-paper/30 text-paper/75"
      }`}
    >
      {label}
      {unread > 0 ? (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[0.55rem] text-white">
          {unread}
        </span>
      ) : null}
    </button>
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

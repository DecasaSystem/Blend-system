"use client";

import { useCallback, useEffect, useState } from "react";
import ChatThread from "../ChatThread";
import { deliveryChat, sendDeliveryMessage, type ChatMessage, type Location } from "@/actions/chat";
import type { Order } from "@/lib/orders";

/**
 * El chat del repartidor con el cliente de un domicilio, como hoja sobre la
 * pantalla de reparto. Respuestas rápidas para no teclear en la moto y el
 * botón 📍 para decir «aquí estoy» con el punto exacto.
 */

const QUICK_COURIER = [
  "Ya salí con tu pedido",
  "Estoy llegando",
  "Ya llegué, estoy afuera",
  "No encuentro la dirección, ¿me ayudas?",
  "¿Puedes bajar, por favor?",
];

const REFRESH_MS = 4000;

export default function DeliveryChat({ order, onClose }: { order: Order; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  const load = useCallback(async () => {
    const res = await deliveryChat(order.id, true).catch(() => null);
    if (res) setMessages((prev) => (prev && res.messages.length < prev.length ? prev : res.messages));
  }, [order.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const send = async (body: string, location?: Location | null) => {
    const res = await sendDeliveryMessage(order.id, body, location);
    if ("error" in res) return res.error;
    setMessages((m) => [...(m ?? []), res.message]);
    load();
    return null;
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-ink/40 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <button type="button" className="flex-1" aria-label="Cerrar" onClick={onClose} />
      <section
        className="flex flex-col overflow-hidden rounded-t-[26px] border-t-[1.5px] border-ink bg-paper"
        style={{ height: "min(40rem, 88dvh)" }}
      >
        <header className="flex items-center gap-3 border-b-[1.5px] border-ink bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">
              {order.customer.name} · {order.id}
            </p>
            <p className="u-mono truncate normal-case tracking-[0.01em] text-ink/45">
              {order.customer.address}
            </p>
          </div>
          <a
            href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
            className="u-mono grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20"
            aria-label="Llamar al cliente"
          >
            📞
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el chat"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20"
          >
            ✕
          </button>
        </header>
        <ChatThread
          messages={messages}
          mine={["courier", "staff"]}
          onSend={send}
          quickReplies={QUICK_COURIER}
          allowLocation
          placeholder="Escríbele al cliente…"
          empty={
            <>
              Aquí hablas con {order.customer.name.split(" ")[0]} sobre este domicilio. Toca una
              respuesta rápida, o 📍 para mandarle dónde estás. Le llega al celular aunque tenga la
              tienda cerrada.
            </>
          }
        />
      </section>
    </div>
  );
}

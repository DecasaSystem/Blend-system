"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { defaultOptions, offerPriceOf, priceOf } from "@/lib/cart";
import type { AssistantAction } from "@/lib/assistant";

/**
 * Lo que el asistente puede hacer en la página.
 *
 * El servidor ya validó la acción; aquí sólo se ejecuta con lo que hay a
 * mano: el carrito, la hoja de producto y el enrutador. La hoja y el carrito
 * viven en la portada, así que fuera de ella la acción se guarda, se navega
 * a la portada y se ejecuta al llegar (`usePendingAssistantAction`). El chat
 * se vuelve a abrir solo después de navegar para no dejar la conversación
 * a medias.
 */

const PENDING_KEY = "blend.asistente.pendiente";
export const REOPEN_KEY = "blend.chat.reabrir";

function remember(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin sessionStorage (modo privado estricto): la acción se pierde, nada más.
  }
}

export function useAssistantActions() {
  const router = useRouter();
  const pathname = usePathname();
  const { add, openSheet, setOpen } = useCart();
  const { products, sizes, builderBases, dailyIds, dailyOffer } = useSite();

  const run = useCallback(
    (action: AssistantAction) => {
      const home = pathname === "/";
      const goHome = () => {
        remember(PENDING_KEY, action);
        remember(REOPEN_KEY, true);
        router.push("/");
      };

      switch (action.name) {
        case "ir_a": {
          if (!home) {
            remember(REOPEN_KEY, true);
            router.push(`/#${action.seccion}`);
            return;
          }
          document.getElementById(action.seccion)?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        case "abrir_producto": {
          if (!home) return goHome();
          const p = products.find((x) => x.id === action.productId);
          if (p) openSheet(p);
          return;
        }
        case "agregar_al_carrito": {
          if (!home) return goHome();
          const p = products.find((x) => x.id === action.productId);
          if (!p || p.soldOut) return;
          const sizeId = action.sizeId ?? sizes[0]?.id ?? "";
          const options = defaultOptions(builderBases[0]?.name ?? "", sizeId);
          // Si es la del día y quedan, va con su precio, como desde la tarjeta.
          const offer = dailyIds.includes(p.id) ? dailyOffer[p.id] : null;
          if (offer && offer.left > 0) {
            add({
              productId: p.id,
              keySuffix: "dia",
              name: p.name,
              color: p.color,
              basePrice: offerPriceOf(p, offer.price, sizeId, sizes),
              listPrice: priceOf(p, sizeId, sizes),
              offerLabel: "Precio del día",
              maxQty: offer.left,
              qty: Math.min(action.qty, offer.left),
              options,
            });
          } else {
            add({
              productId: p.id,
              name: p.name,
              color: p.color,
              basePrice: priceOf(p, sizeId, sizes),
              qty: action.qty,
              options,
            });
          }
          return;
        }
        case "abrir_carrito": {
          if (!home) return goHome();
          setOpen(true);
          return;
        }
        case "ir_a_pagina": {
          if (action.ruta === pathname) return;
          remember(REOPEN_KEY, true);
          router.push(action.ruta);
          return;
        }
      }
    },
    [pathname, router, add, openSheet, setOpen, products, sizes, builderBases, dailyIds, dailyOffer],
  );

  return run;
}

/** En la portada: si quedó una acción pendiente de otra página, se ejecuta. */
export function usePendingAssistantAction() {
  const run = useAssistantActions();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/") return;
    let action: AssistantAction | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) action = JSON.parse(raw) as AssistantAction;
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      return;
    }
    if (action) run(action);
    // Sólo al montar la portada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}

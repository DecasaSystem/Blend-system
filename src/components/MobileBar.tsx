"use client";

import { useCart } from "./CartProvider";
import { money } from "@/lib/cart";

/** Barra inferior en móvil: el carrito siempre a un pulgar de distancia. */
export default function MobileBar() {
  const { count, subtotal, setOpen, open, sheet, toast } = useCart();
  // Se esconde con el carrito, la hoja o el aviso encima: no debe competir con ellos.
  const visible = count > 0 && !open && sheet === null && toast === null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[75] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all duration-300 lg:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-full border-[1.5px] border-ink bg-ink px-5 py-3.5 text-paper shadow-[0_10px_30px_rgba(27,11,46,0.35)]"
      >
        <span className="u-mono flex items-center gap-2">
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-mango px-1.5 text-[0.6rem] text-white">
            {count}
          </span>
          Ver pedido
        </span>
        <span className="u-display text-2xl">{money(subtotal)}</span>
      </button>
    </div>
  );
}

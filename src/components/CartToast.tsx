"use client";

import { useCart } from "./CartProvider";
import { money } from "@/lib/cart";

/**
 * Confirmación de "agregado". Reemplaza al carrito que se abría solo:
 * confirma sin cortar el flujo de quien está pidiendo varias cosas.
 */
export default function CartToast() {
  const { toast, count, subtotal, setOpen, dismissToast, open } = useCart();
  const visible = toast !== null && !open;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-[4.5rem] z-[85] flex justify-center px-4 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
      aria-live="polite"
    >
      <div
        className={`flex w-full max-w-sm items-center gap-3 rounded-full border-[1.5px] border-ink bg-ink px-3 py-2 text-paper shadow-[0_10px_30px_rgba(27,11,46,0.35)] ${
          visible ? "pointer-events-auto" : ""
        }`}
      >
        <span
          className="h-8 w-8 shrink-0 rounded-full border-[1.5px] border-paper/50"
          style={{ background: toast?.color ?? "transparent" }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9rem] font-medium leading-tight">
            {toast?.name} en el pedido
          </p>
          <p className="u-mono text-paper/50">
            {count} {count === 1 ? "artículo" : "artículos"} · {money(subtotal)}
          </p>
        </div>
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={() => {
            dismissToast();
            setOpen(true);
          }}
          className="u-mono shrink-0 rounded-full bg-mango px-3.5 py-2 text-white"
        >
          Ver
        </button>
      </div>
    </div>
  );
}

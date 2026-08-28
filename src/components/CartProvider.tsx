"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MAX_QTY,
  lineKey,
  totals,
  unitPrice,
  type CartLine,
  type DeliveryMode,
  type LineOptions,
} from "@/lib/cart";
import type { Product } from "@/lib/content";
import { useSite } from "./SiteProvider";

const STORAGE_KEY = "blend.cart.v2";

/** Lo que se pide agregar; la clave y el precio unitario se calculan aquí. */
export type AddInput = {
  productId: string;
  name: string;
  color: string;
  basePrice: number;
  listPrice?: number;
  qty?: number;
  options?: LineOptions;
  custom?: string[];
  offerLabel?: string;
  maxQty?: number;
  /** Diferencia líneas que comparten producto y opciones (p. ej. la del día). */
  keySuffix?: string;
};

type SheetTarget = { product: Product; lineKey?: string } | null;

type CartState = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  delivery: number;
  total: number;
  freeDelivery: boolean;
  missingForFree: number;
  mode: DeliveryMode;
  storeId: string;
  open: boolean;
  toast: { name: string; color: string } | null;
  sheet: SheetTarget;
  add: (input: AddInput) => void;
  replaceLine: (key: string, input: AddInput) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (v: boolean) => void;
  setMode: (m: DeliveryMode) => void;
  setStoreId: (id: string) => void;
  openSheet: (product: Product, lineKey?: string) => void;
  closeSheet: () => void;
  dismissToast: () => void;
  lineByKey: (key: string) => CartLine | undefined;
};

const Ctx = createContext<CartState | null>(null);

type Persisted = { lines: CartLine[]; mode: DeliveryMode; storeId: string };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toppings, stores } = useSite();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [mode, setMode] = useState<DeliveryMode>("envio");
  const [storeId, setStoreId] = useState(stores[0].id);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget>(null);
  const [toast, setToast] = useState<{ name: string; color: string } | null>(null);
  // Estado, no ref: el efecto de guardado debe saltarse el primer render y volver
  // a correr cuando ya se leyó lo guardado. Con un ref escribiría vacío encima.
  const [loaded, setLoaded] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Persisted>;
        if (Array.isArray(saved.lines)) setLines(saved.lines);
        if (saved.mode === "envio" || saved.mode === "recoger") setMode(saved.mode);
        if (saved.storeId) setStoreId(saved.storeId);
      }
    } catch {
      /* almacenamiento no disponible */
    }
    setLoaded(true);
  }, []);

  // Si el equipo borra la sede elegida, vuelve a la primera.
  useEffect(() => {
    if (!stores.some((s) => s.id === storeId)) setStoreId(stores[0].id);
  }, [stores, storeId]);

  useEffect(() => {
    // No escribir antes de leer: borraría el carrito guardado.
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, mode, storeId }));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [loaded, lines, mode, storeId]);

  // El drawer y la hoja bloquean el scroll de fondo.
  useEffect(() => {
    const locked = open || sheet !== null;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, sheet]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const flash = useCallback((name: string, color: string) => {
    setToast({ name, color });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const buildLine = useCallback(
    (input: AddInput): CartLine => {
      const key = lineKey(input.productId, input.options, input.keySuffix);
      return {
        key,
        productId: input.productId,
        name: input.name,
        color: input.color,
        unitPrice: unitPrice(input.basePrice, input.options, toppings),
        basePrice: input.basePrice,
        listPrice: input.listPrice,
        qty: input.qty ?? 1,
        options: input.options,
        custom: input.custom,
        offerLabel: input.offerLabel,
        maxQty: input.maxQty,
        keySuffix: input.keySuffix,
      };
    },
    [toppings],
  );

  const add = useCallback<CartState["add"]>(
    (input) => {
      const line = buildLine(input);
      setLines((prev) => {
        const found = prev.find((l) => l.key === line.key);
        if (!found) return [...prev, line];
        const cap = Math.min(line.maxQty ?? MAX_QTY, MAX_QTY);
        return prev.map((l) =>
          l.key === line.key ? { ...l, qty: Math.min(cap, l.qty + line.qty) } : l,
        );
      });
      // Sin abrir el carrito: cortaría el flujo de quien pide varias cosas.
      flash(input.name, input.color);
    },
    [buildLine, flash],
  );

  /** Guarda la edición de una línea. Si las opciones nuevas chocan con otra, se fusionan. */
  const replaceLine = useCallback<CartState["replaceLine"]>(
    (key, input) => {
      const next = buildLine(input);
      setLines((prev) => {
        const without = prev.filter((l) => l.key !== key);
        const collision = without.find((l) => l.key === next.key);
        if (collision) {
          const cap = Math.min(next.maxQty ?? MAX_QTY, MAX_QTY);
          return without.map((l) =>
            l.key === next.key ? { ...l, qty: Math.min(cap, l.qty + next.qty) } : l,
          );
        }
        // Conserva la posición original de la línea editada.
        const at = prev.findIndex((l) => l.key === key);
        const copy = [...without];
        copy.splice(at < 0 ? copy.length : at, 0, next);
        return copy;
      });
      flash(input.name, input.color);
    },
    [buildLine, flash],
  );

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) =>
            l.key === key
              ? { ...l, qty: Math.min(qty, Math.min(l.maxQty ?? MAX_QTY, MAX_QTY)) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const openSheet = useCallback((product: Product, key?: string) => {
    setSheet({ product, lineKey: key });
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const value = useMemo<CartState>(() => {
    const t = totals(lines, mode);
    return {
      lines,
      ...t,
      mode,
      storeId,
      open,
      toast,
      sheet,
      add,
      replaceLine,
      setQty,
      remove,
      clear,
      setOpen,
      setMode,
      setStoreId,
      openSheet,
      closeSheet,
      dismissToast,
      lineByKey: (key: string) => lines.find((l) => l.key === key),
    };
  }, [
    lines,
    mode,
    storeId,
    open,
    toast,
    sheet,
    add,
    replaceLine,
    setQty,
    remove,
    clear,
    openSheet,
    closeSheet,
    dismissToast,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}

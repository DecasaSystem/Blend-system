"use client";

import { useMemo, useState } from "react";

/**
 * Una lista larga de opciones (ingredientes, adicionales) que no debe
 * alargar la pantalla sin fin: se enseñan los primeros `limit` y un chip
 * «+N más» despliega el resto. Lo ya elegido se enseña siempre, esté donde
 * esté en la lista: nadie debe perder de vista lo que marcó.
 *
 * Con pocas opciones no pasa nada: se enseñan todas y no hay chip.
 */
export function useCollapsed<T>(items: T[], isKept: (item: T) => boolean, limit: number) {
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    if (expanded || items.length <= limit) return items;
    const head = items.slice(0, limit);
    // Lo elegido fuera de los primeros se suma al final.
    const kept = items.slice(limit).filter(isKept);
    return [...head, ...kept];
  }, [items, isKept, limit, expanded]);

  const hidden = items.length - visible.length;
  return {
    visible,
    hidden,
    expanded,
    /** Si hace falta el chip de más/menos. */
    collapsible: items.length > limit,
    toggle: () => setExpanded((v) => !v),
  };
}

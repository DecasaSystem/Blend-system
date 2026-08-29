"use client";

import { createContext, useContext } from "react";
import { defaultSite, type SiteContent } from "@/lib/site";

/**
 * Contenido del sitio para toda la app.
 *
 * Llega ya resuelto desde el servidor (ver el layout raíz), así que el HTML del
 * servidor y el del navegador coinciden y no hay parpadeo al hidratar.
 */
const Ctx = createContext<SiteContent>(defaultSite());

export function SiteProvider({
  value,
  children,
}: {
  value: SiteContent;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite() {
  return useContext(Ctx);
}

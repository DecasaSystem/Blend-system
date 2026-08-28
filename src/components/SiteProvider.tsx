"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { defaultSite, readSite, subscribeSite, type SiteContent } from "@/lib/site";

/**
 * Contenido del sitio para toda la app.
 * Arranca con los valores de fábrica (los mismos que renderiza el servidor) y
 * cambia a lo guardado tras hidratar, para no romper el HTML del servidor.
 */
const Ctx = createContext<SiteContent>(defaultSite());

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [site, setSite] = useState<SiteContent>(defaultSite);

  useEffect(() => {
    const sync = () => setSite(readSite());
    sync();
    return subscribeSite(sync);
  }, []);

  return <Ctx.Provider value={site}>{children}</Ctx.Provider>;
}

export function useSite() {
  return useContext(Ctx);
}

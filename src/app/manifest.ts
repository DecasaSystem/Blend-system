import type { MetadataRoute } from "next";
import { brand } from "@/lib/content";

/**
 * Web app manifest: nombre, colores e iconos para «Añadir a inicio» en el
 * teléfono y para que Google muestre bien el nombre del sitio.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — ${brand.tagline}`,
    short_name: brand.name,
    description: `${brand.tagline} en ${brand.city}, Quindío. Pide en línea y recoge o recibe a domicilio.`,
    lang: "es-CO",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1ff",
    theme_color: "#1b0b2e",
    categories: ["food", "shopping"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

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
    // El logo de la marca, generado desde el original en los tamaños que
    // piden Android (192 y 512) e iPhone (180). `maskable` deja que Android
    // lo recorte a su forma sin que se vean esquinas.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "maskable" },
    ],
  };
}

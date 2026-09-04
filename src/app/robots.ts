import type { MetadataRoute } from "next";

/**
 * robots.txt: lo público se indexa, lo operativo no.
 *
 * Fuera del índice: el panel del equipo, la pantalla del quiosco, el flujo de
 * compra y las cuentas. Nada de eso aporta a una búsqueda y todo eso filtra
 * páginas internas que nadie debería encontrar en Google.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/equipo", "/quiosco", "/checkout", "/cuenta", "/api/"],
      },
    ],
    sitemap: "https://blend.cafe/sitemap.xml",
  };
}

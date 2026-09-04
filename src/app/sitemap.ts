import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";

/**
 * sitemap.xml: sólo lo indexable.
 *
 * La tienda es una sola página pública con anclas por sección; las demás rutas
 * son compra, cuentas, equipo o quiosco, y van con noindex en vez de aquí.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteOrigin();
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}

import type { Metadata } from "next";
import type { SiteContent } from "./site";

/**
 * SEO: base canónica, metadata rica y datos estructurados (JSON-LD).
 *
 * Todo lo que Google necesita sin tocar el diseño: la URL canónica sale de
 * `NEXT_PUBLIC_SITE_URL` (o del host de la petición como respaldo, igual que
 * hace el checkout), y los JSON-LD se arman con el contenido publicado para
 * que el menú y las preguntas que ve Google sean las vigentes.
 */

/** Origen canónico. En build se resuelve estático; en runtime usa el host. */
export function siteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Respaldo para desarrollo y previews sin variable configurada.
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://blend.cafe";
}

export const metadataBase = new URL(siteOrigin());

const OG_LOCALE = "es_CO";

/** Metadata completa para una página pública: canonical + Open Graph + Twitter. */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path?: string;
  image?: string;
}): Metadata {
  const url = opts.path ? `${siteOrigin()}${opts.path}` : siteOrigin();
  const image = opts.image ?? `${siteOrigin()}/og.png`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: "BLEND",
      locale: OG_LOCALE,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}

/** LocalBusiness + Organization: quiénes somos, dónde estamos, cuándo abrimos. */
export function localBusinessJsonLd(site: SiteContent) {
  const stores = site.stores.map((s) => ({
    "@type": "Store",
    name: s.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address,
      addressLocality: "Armenia",
      addressRegion: "Quindío",
      addressCountry: "CO",
    },
    geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng },
    openingHours: s.hours,
    telephone: s.phone,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    "@id": `${siteOrigin()}/#negocio`,
    name: site.brand.name,
    description: `${site.brand.tagline} en Armenia, Quindío. ${site.brand.delivery}.`,
    url: siteOrigin(),
    image: site.brand.logo || undefined,
    telephone: site.brand.phone,
    email: site.brand.email,
    priceRange: "$$",
    servesCuisine: ["Batidos", "Matcha", "Açaí bowls", "Cold brew"],
    areaServed: { "@type": "City", name: "Armenia" },
    sameAs: [`https://www.instagram.com/${site.brand.instagram.replace(/^@/, "")}`],
    department: stores,
  };
}

/** Menu: las categorías y bebidas del catálogo publicado. */
export function menuJsonLd(site: SiteContent) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${siteOrigin()}/#menu`,
    name: `Menú ${site.brand.name}`,
    inLanguage: "es-CO",
    hasMenuSection: site.categories.map((c) => ({
      "@type": "MenuSection",
      name: c.name,
      description: c.note || undefined,
      hasMenuItem: site.products
        .filter((p) => p.category === c.id && !p.soldOut)
        .map((p) => ({
          "@type": "MenuItem",
          name: p.name,
          description: p.tagline,
          image: p.media || undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "COP",
            price: Math.min(...Object.values(p.prices)),
          },
        })),
    })),
  };
}

/** FAQPage: las preguntas del sitio, para el acordeón de resultados. */
export function faqJsonLd(site: SiteContent) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteOrigin()}/#preguntas`,
    mainEntity: site.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

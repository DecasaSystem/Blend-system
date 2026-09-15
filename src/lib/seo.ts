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

/**
 * Lo que la gente busca en Google y no siempre coincide con cómo lo llama la
 * carta: «smoothie» y «batido» son lo mismo para el cliente; «jugos
 * naturales» es la búsqueda más común de la ciudad. Va en keywords, en la
 * cocina del negocio y en el texto SEO.
 */
export const SEARCH_TERMS = [
  "batidos",
  "smoothies",
  "jugos naturales",
  "matcha",
  "açaí bowls",
  "cold brew",
  "crispetas",
];

/** Metadata completa para una página pública: canonical + Open Graph + Twitter. */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path?: string;
  image?: string;
}): Metadata {
  const url = opts.path ? `${siteOrigin()}${opts.path}` : siteOrigin();
  // La imagen sale de `app/opengraph-image.tsx`; sólo se fija aquí si la
  // página trae una propia.
  const images = opts.image
    ? [{ url: opts.image, width: 1200, height: 630, alt: opts.title }]
    : undefined;
  return {
    // `absolute`: el layout tiene la plantilla «BLEND · %s» y estos títulos
    // ya traen la marca; sin esto salía «BLEND · BLEND — Casa de batidos…».
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: "BLEND",
      locale: OG_LOCALE,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: images?.map((i) => i.url),
    },
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * «7:00 – 21:00» → OpeningHoursSpecification. El horario del editor es texto
 * libre; si no tiene la forma hora–hora se deja sin especificar antes que
 * inventar uno.
 */
function openingHours(text: string) {
  const m = text.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const pad = (h: string) => h.padStart(2, "0");
  return {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: DAYS,
    opens: `${pad(m[1])}:${m[2]}`,
    closes: `${pad(m[3])}:${m[4]}`,
  };
}

function address(street: string) {
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    addressLocality: "Armenia",
    addressRegion: "Quindío",
    addressCountry: "CO",
  };
}

/** Lo que se sirve: las categorías publicadas más los términos de búsqueda. */
function cuisines(site: SiteContent) {
  const seen = new Set<string>();
  // «Extras» (shots, granolas) no es una cocina que alguien busque.
  const own = site.categories.filter((c) => c.id !== "extras").map((c) => c.name);
  return [...own, ...SEARCH_TERMS].filter((c) => {
    const k = c.toLocaleLowerCase("es");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** LocalBusiness + Organization: quiénes somos, dónde estamos, cuándo abrimos. */
export function localBusinessJsonLd(site: SiteContent) {
  const origin = siteOrigin();
  const stores = site.stores.map((s) => ({
    "@type": "CafeOrCoffeeShop",
    "@id": `${origin}/#sede-${s.id}`,
    name: s.name,
    address: address(s.address),
    geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng },
    openingHoursSpecification: openingHours(s.hours),
    telephone: s.phone,
    amenityFeature: s.services.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
  }));
  const main = site.stores[0];

  return {
    "@context": "https://schema.org",
    "@type": ["CafeOrCoffeeShop", "Organization"],
    "@id": `${origin}/#negocio`,
    name: site.brand.name,
    description: `${site.brand.tagline} en Armenia, Quindío. ${site.brand.delivery}.`,
    url: origin,
    // El logo que Google enseña en la ficha del negocio. Se sirve desde el
    // propio dominio, cuadrado y limpio (sin el margen del archivo original):
    // es el mismo del favicon, así la pestaña y el buscador enseñan lo mismo.
    logo: { "@type": "ImageObject", url: `${origin}/icon-512.png`, width: 512, height: 512 },
    image: [`${origin}/opengraph-image`, ...(site.brand.logo ? [site.brand.logo] : [])],
    telephone: site.brand.phone,
    email: site.brand.email,
    priceRange: "$$",
    currenciesAccepted: "COP",
    paymentAccepted: "Efectivo, Tarjeta",
    servesCuisine: cuisines(site),
    address: main ? address(main.address) : undefined,
    geo: main ? { "@type": "GeoCoordinates", latitude: main.lat, longitude: main.lng } : undefined,
    openingHoursSpecification: main ? openingHours(main.hours) : undefined,
    areaServed: { "@type": "City", name: "Armenia" },
    hasMenu: { "@id": `${origin}/#menu` },
    // «Pedir en línea» en la ficha de Google.
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/#menu`,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModePickUp"],
    },
    sameAs: [`https://www.instagram.com/${site.brand.instagram.replace(/^@/, "")}`],
    department: stores,
  };
}

/** WebSite: para que Google use «BLEND» como nombre del sitio en resultados. */
export function websiteJsonLd(site: SiteContent) {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#sitio`,
    url: origin,
    name: site.brand.name,
    alternateName: `${site.brand.name} ${site.brand.city}`,
    inLanguage: "es-CO",
    publisher: { "@id": `${origin}/#negocio` },
  };
}

function lowestPrice(prices: Record<string, number>) {
  const values = Object.values(prices).filter((n) => n > 0);
  return values.length ? Math.min(...values) : undefined;
}

/** Menu: las categorías y bebidas del catálogo publicado. */
export function menuJsonLd(site: SiteContent) {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${origin}/#menu`,
    name: `Menú ${site.brand.name}`,
    url: `${origin}/#menu`,
    inLanguage: "es-CO",
    hasMenuSection: site.categories.map((c) => ({
      "@type": "MenuSection",
      name: c.name,
      description: c.note || undefined,
      hasMenuItem: site.products
        .filter((p) => p.category === c.id && !p.soldOut)
        .map((p) => ({
          "@type": "MenuItem",
          "@id": `${origin}/#producto-${p.id}`,
          name: p.name,
          description: p.tagline,
          image: p.media || undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "COP",
            price: lowestPrice(p.prices),
            availability: "https://schema.org/InStock",
          },
        })),
    })),
  };
}

/**
 * Product por bebida. El Menu describe la carta; Product es lo que Google usa
 * para los fragmentos con precio («Mango Terco · $14.900») cuando alguien
 * busca un batido concreto en Armenia.
 */
export function productsJsonLd(site: SiteContent) {
  const origin = siteOrigin();
  const byId = new Map(site.categories.map((c) => [c.id, c.name]));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${origin}/#productos`,
    name: `Carta de ${site.brand.name}`,
    itemListElement: site.products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        "@id": `${origin}/#producto-${p.id}`,
        name: p.name,
        description: p.tagline,
        image: p.media || undefined,
        category: byId.get(p.category),
        brand: { "@type": "Brand", name: site.brand.name },
        offers: {
          "@type": "Offer",
          url: `${origin}/#menu`,
          priceCurrency: "COP",
          price: lowestPrice(p.prices),
          availability: p.soldOut
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
          seller: { "@id": `${origin}/#negocio` },
        },
      },
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

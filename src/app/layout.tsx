import type { Metadata, Viewport } from "next";
import { Poppins, Martian_Mono } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import { SiteProvider } from "@/components/SiteProvider";
import SeoJsonLd from "@/components/SeoJsonLd";
import { loadSiteContent } from "@/actions/content";
import { localBusinessJsonLd, metadataBase, SEARCH_TERMS, siteOrigin, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

/**
 * Poppins lleva los titulares y el cuerpo. No es variable como las que había
 * antes, así que hay que pedir los pesos uno a uno: sólo los cinco que el
 * sistema usa de verdad, para no bajar archivos que nadie va a ver.
 */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
  display: "swap",
});

/** Se queda: es la letra de ticket de precios, etiquetas y números de pedido. */
const martian = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "BLEND — Casa de batidos, matcha y açaí en Armenia",
    template: "BLEND · %s",
  },
  description:
    "Batidos y smoothies de fruta congelada, jugos naturales, matcha ceremonial de Uji, açaí bowls y crispetas en Armenia, Quindío. Pide en línea y recoge en 25 minutos.",
  applicationName: "BLEND",
  category: "food",
  // Lo que se busca, con y sin ciudad: Google pondera más el texto de la
  // página, pero esto ayuda a que la ficha se asocie a Armenia.
  keywords: [
    ...SEARCH_TERMS.map((t) => `${t} armenia`),
    "batidos naturales quindío",
    "smoothies saludables armenia",
    "matcha ceremonial armenia",
    "domicilios saludables armenia",
    "desayunos saludables armenia",
  ],
  alternates: { canonical: siteOrigin() },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: true, email: true, address: true },
  openGraph: {
    title: "BLEND — Casa de batidos, matcha y açaí en Armenia",
    description:
      "Batidos de fruta congelada, matcha ceremonial de Uji y açaí bowls. Pide en línea y recoge en 25 minutos.",
    url: siteOrigin(),
    siteName: "BLEND",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BLEND — Casa de batidos, matcha y açaí en Armenia",
    description:
      "Batidos de fruta congelada, matcha ceremonial de Uji y açaí bowls. Pide en línea y recoge en 25 minutos.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B0B2E",
  width: "device-width",
  initialScale: 1,
  // Necesario para que env(safe-area-inset-*) funcione en iPhone.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El contenido se resuelve en el servidor: la tienda llega pintada y no
  // parpadea al hidratar.
  const site = await loadSiteContent();

  return (
    <html
      lang="es-CO"
      data-scroll-behavior="smooth"
      className={`${poppins.variable} ${martian.variable}`}
    >
      <head>
        <SeoJsonLd data={[localBusinessJsonLd(site), websiteJsonLd(site)]} />
      </head>
      <body>
        {/* El carrito vive aquí para que /checkout lea el mismo pedido que la tienda.
            El contenido va por fuera: el carrito necesita los precios de los toppings. */}
        <SiteProvider value={site}>
          <CartProvider>{children}</CartProvider>
        </SiteProvider>
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}

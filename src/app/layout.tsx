import type { Metadata, Viewport } from "next";
import { Fraunces, Archivo, Martian_Mono } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import { SiteProvider } from "@/components/SiteProvider";
import { loadSiteContent } from "@/actions/content";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
  display: "swap",
});

const martian = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BLEND — Casa de batidos, matcha y açaí",
  description:
    "Batidos de fruta congelada, matcha ceremonial de Uji y açaí bowls. Pide en línea y recoge en 25 minutos.",
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
      lang="es"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${archivo.variable} ${martian.variable}`}
    >
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

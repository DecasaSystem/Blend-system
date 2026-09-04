import type { Metadata } from "next";
import Marquee from "@/components/Marquee";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import DailyBlends from "@/components/DailyBlends";
import MenuSection from "@/components/MenuSection";
import BlendBuilder from "@/components/BlendBuilder";
import Process from "@/components/Process";
import Rewards from "@/components/Rewards";
import Stores from "@/components/Stores";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import CartToast from "@/components/CartToast";
import ProductSheet from "@/components/ProductSheet";
import MobileBar from "@/components/MobileBar";
import SeoCopy from "@/components/SeoCopy";
import SeoJsonLd from "@/components/SeoJsonLd";
import { getCustomer } from "@/lib/customer-session";
import { loadSiteContent } from "@/actions/content";
import { faqJsonLd, menuJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "BLEND — Casa de batidos, matcha y açaí en Armenia",
  description:
    "Batidos de fruta congelada, matcha ceremonial de Uji, açaí bowls y cold brew en Armenia, Quindío. Sedes Norte y Centro. Pide en línea, recoge en 25 minutos o recibe a domicilio.",
  path: "/",
});

export default async function Home() {
  const customer = await getCustomer();
  const site = await loadSiteContent();

  return (
    <>
      <SeoJsonLd data={[menuJsonLd(site), faqJsonLd(site)]} />
      <Marquee />
      <Nav signedIn={Boolean(customer)} />
      <main>
        <Hero />
        <DailyBlends />
        <MenuSection />
        <BlendBuilder />
        <Process />
        <Rewards />
        <Stores />
        <Contact />
        <SeoCopy site={site} />
      </main>
      <Footer />
      {/* La hoja vive aquí, no dentro del menú: el carrito también la abre para editar */}
      <ProductSheet />
      <CartDrawer />
      <CartToast />
      <MobileBar />
    </>
  );
}

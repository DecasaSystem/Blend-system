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
import { getCustomer } from "@/lib/customer-session";

export default async function Home() {
  const customer = await getCustomer();

  return (
    <>
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

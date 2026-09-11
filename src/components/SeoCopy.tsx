import type { SiteContent } from "@/lib/site";

/**
 * Texto SEO de la tienda.
 *
 * Un <aside> con `sr-only`: invisible en pantalla, legible para Google y para
 * lectores de pantalla. Describe el negocio con sus palabras clave reales
 * (batidos en Armenia, matcha ceremonial, açaí bowls, domicilios) y se arma
 * con el contenido publicado, así que si el equipo cambia el menú o las
 * sedes, lo que lee Google cambia solo.
 *
 * No es cloaking: es el mismo contenido de la página, redactado en prosa para
 * quien no puede ver el diseño.
 */
export default function SeoCopy({ site }: { site: SiteContent }) {
  const menu = site.categories
    .map((c) => {
      const items = site.products
        .filter((p) => p.category === c.id && !p.soldOut)
        .map((p) => p.name)
        .join(", ");
      return items ? `${c.name}: ${items}` : null;
    })
    .filter(Boolean)
    .join(". ");

  const delDia = site.dailyIds
    .map((id) => site.products.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const sedes = site.stores
    .map((s) => `${s.name}, ${s.address}. Horario ${s.hours}`)
    .join(". ");

  // Lo que vende el quiosco y no está en la carta web (las crispetas, por
  // ejemplo) también cuenta: es lo que la gente busca de una tienda física.
  const cajasQuiosco = site.kiosk.categories
    .map((c) => c.name)
    .filter((n) => !site.categories.some((c) => c.name === n));
  const categorias = site.categories.map((c) => c.name.toLocaleLowerCase("es")).join(", ");

  return (
    <aside className="sr-only" aria-label={`Sobre ${site.brand.name}`}>
      <h2>
        {site.brand.name}: {site.brand.tagline} en Armenia, Quindío
      </h2>
      <p>
        {site.brand.name} es una casa de batidos, smoothies y jugos naturales de fruta congelada en
        Armenia, Quindío, Colombia. Batidos saludables sin azúcar añadida, matcha ceremonial de Uji,
        açaí bowls con granola de la casa, cold brew de 18 horas y shots de jengibre
        {cajasQuiosco.length ? `, y en tienda ${cajasQuiosco.join(", ").toLocaleLowerCase("es")}` : ""}
        . {site.brand.delivery}. Pedidos en línea con pago con tarjeta o en efectivo, y puntos de
        venta en {site.stores.length} {site.stores.length === 1 ? "sede" : "sedes"}. Teléfono{" "}
        {site.brand.phone}.
      </p>
      <h2>Menú de {categorias}</h2>
      <p>{menu}.</p>
      {delDia ? (
        <>
          <h2>Batidos del día con precio especial</h2>
          <p>Ofertas del día en BLEND Armenia: {delDia}. Precio rebajado con unidades limitadas.</p>
        </>
      ) : null}
      <h2>Arma tu blend personalizado</h2>
      <p>
        Constructor de batidos a tu medida: elige la base entre{" "}
        {site.builderBases.map((b) => b.name).join(", ")}, suma frutas tropicales como{" "}
        {site.builderIngredients
          .slice(0, 6)
          .map((b) => b.name)
          .join(", ")}{" "}
        y corona con adicionales como {site.toppings.map((t) => t.name).join(", ")}.
      </p>
      <h2>Dos sedes en Armenia, Quindío</h2>
      <p>
        {sedes}. Domicilios saludables en Armenia y pedidos para recoger en tienda. Jugos naturales,
        desayunos saludables y opciones sin lácteos en el Quindío.
      </p>
    </aside>
  );
}

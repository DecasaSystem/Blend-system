"use client";

import SectionHead from "./SectionHead";
import VesselArt from "./VesselArt";
import InkField from "./InkField";
import { useCart } from "./CartProvider";
import { useSite } from "./SiteProvider";
import { defaultOptions, money } from "@/lib/cart";

export default function DailyBlends() {
  const { add, openSheet } = useCart();
  const { sections, dailyIds, dailyOffer, products, builderBases, sizes } = useSite();

  const today = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  // El equipo puede quitar del catálogo un producto que estaba de oferta.
  const items = dailyIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && Boolean(dailyOffer[p!.id]));

  if (items.length === 0) return null;

  return (
    <section id="del-dia" className="relative overflow-hidden bg-paper-2 py-20 lg:py-28">
      <InkField
        className="opacity-45"
        blobs={[
          { color: "#FFD166", size: 26, x: -6, y: 6 },
          { color: "#8FD14F", size: 20, x: 84, y: 62 },
        ]}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <SectionHead
          copy={sections.daily}
          eyebrowSuffix={today}
          tone="#FF6A1A"
          right={
            <div className="sticker" style={{ background: "#8FD14F" }}>
              Se acaban a las 21:00
            </div>
          }
        />

        {/* Riel en móvil, rejilla a partir de sm */}
        <div className="rail -mx-4 mt-12 gap-4 px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:px-0 lg:grid-cols-3">
          {items.map((p, idx) => {
            const offer = dailyOffer[p.id];
            const pct = Math.min(100, Math.round((offer.left / 30) * 100));
            const agotado = p.soldOut || offer.left <= 0;

            /* Lo que hay que arrastrar para que personalizarla no le quite el
               precio del día. */
            const oferta = {
              basePrice: offer.price,
              listPrice: p.price,
              offerLabel: "Precio del día",
              maxQty: offer.left,
              keySuffix: "dia",
            };
            const personalizar = () => openSheet(p, { offer: oferta });

            return (
              <article
                key={p.id}
                className="card-ink flex w-[80vw] max-w-[340px] flex-col p-5 sm:w-auto sm:max-w-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="u-mono rounded-full bg-ink px-2.5 py-1 text-[0.58rem] text-paper">
                    0{idx + 1} / del día
                  </span>
                  <span className="u-mono text-ink/40">{p.kcal} kcal</span>
                </div>

                {/* Igual que en el menú: la ilustración y el nombre abren la hoja. */}
                <button
                  type="button"
                  onClick={personalizar}
                  disabled={agotado}
                  className="relative mx-auto my-2 w-[62%] max-w-[190px] transition-transform duration-500 hover:-rotate-2 hover:scale-105 disabled:cursor-not-allowed"
                  style={{ filter: "drop-shadow(3px 5px 0 rgba(27,11,46,0.10))" }}
                  aria-label={`Personalizar ${p.name}`}
                >
                  <VesselArt
                    uid={`daily-${p.id}`}
                    vessel={p.vessel}
                    color={p.color}
                    ingredients={p.ingredients}
                    media={p.media}
                    className="h-auto w-full"
                    alt={p.name}
                  />
                </button>

                <button
                  type="button"
                  onClick={personalizar}
                  disabled={agotado}
                  className="text-left disabled:cursor-not-allowed"
                >
                  <h3 className="u-display text-4xl">{p.name}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/62">{p.tagline}</p>
                </button>
                {offer.why ? <p className="u-mono mt-3 text-ink/40">{offer.why}</p> : null}

                <div className="mt-5 flex items-end gap-2.5">
                  <span className="u-display text-5xl" style={{ color: p.color }}>
                    {money(offer.price)}
                  </span>
                  <span className="u-mono mb-2 text-ink/35 line-through">{money(p.price)}</span>
                </div>

                <div className="mt-4">
                  <div className="u-mono mb-1.5 flex justify-between text-ink/45">
                    <span>Quedan {offer.left}</span>
                    <span>de 30</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: p.color }}
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={personalizar}
                    disabled={agotado}
                    className="u-mono min-h-11 shrink-0 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Personalizar
                  </button>
                  <button
                    type="button"
                    disabled={agotado}
                    onClick={() =>
                      add({
                        productId: p.id,
                        // Separa esta línea de la misma bebida a precio de lista
                        keySuffix: "dia",
                        name: p.name,
                        color: p.color,
                        basePrice: offer.price,
                        listPrice: p.price,
                        offerLabel: "Precio del día",
                        maxQty: offer.left,
                        options: defaultOptions(builderBases[0]?.name ?? "", sizes[0]?.id ?? ""),
                      })
                    }
                    className="btn btn-ube min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {agotado ? "Agotado" : `Agregar ${money(offer.price)}`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

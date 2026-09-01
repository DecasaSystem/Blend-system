"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  Color,
  Media,
  Num,
  Panel,
  Range,
  Row,
  Select,
  StringList,
  Text,
  Toggle,
} from "./fields";
import { money } from "@/lib/cart";
import {
  blankCategory,
  blankProduct,
  blankStore,
  defaultSite,
  sizeKb,
  type SiteContent,
} from "@/lib/site";
import { resetSiteContent, saveSiteContent } from "@/actions/content";
import { useSite } from "@/components/SiteProvider";
import type { SectionKey, Vessel } from "@/lib/content";

const TABS = [
  { id: "carrusel", label: "Carrusel" },
  { id: "dia", label: "Del día" },
  { id: "menu", label: "Menú" },
  { id: "precios", label: "Precios y adicionales" },
  { id: "textos", label: "Textos" },
  { id: "tiendas", label: "Tiendas" },
  { id: "marca", label: "Marca" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VESSELS: { value: Vessel; label: string }[] = [
  { value: "cup", label: "Vaso para llevar" },
  { value: "glass", label: "Vaso de vidrio" },
  { value: "chawan", label: "Chawan (matcha)" },
  { value: "bowl", label: "Bowl" },
  { value: "bottle", label: "Botella" },
];

const SECTION_LABEL: Record<SectionKey, string> = {
  daily: "Batidos del día",
  menu: "Menú",
  builder: "Arma tu blend",
  stores: "Tiendas",
  contact: "Contacto",
};

export default function ContentEditor() {
  const router = useRouter();
  // Lo publicado, tal y como lo está sirviendo el servidor ahora mismo.
  const published = useSite();

  // Borrador local: nada se publica hasta pulsar Publicar.
  const [draft, setDraft] = useState<SiteContent>(published);
  const [saved, setSaved] = useState<SiteContent>(published);
  const [tab, setTab] = useState<TabId>("carrusel");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Si otra persona publica cambios, el borrador propio no se pisa: sólo se
  // actualiza la referencia de lo publicado si no hay nada sin guardar.
  useEffect(() => {
    setSaved(published);
    setDraft((d) => (JSON.stringify(d) === JSON.stringify(saved) ? published : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const customized = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(defaultSite()),
    [saved],
  );

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await saveSiteContent(draft);
        setSaved(draft);
        setFlash("Publicado. La tienda ya lo muestra.");
        setTimeout(() => setFlash(null), 3000);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  const discard = () => setDraft(saved);

  const restore = () => {
    if (!confirm("¿Volver a los textos y precios originales? Se pierde lo que hayas publicado.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await resetSiteContent();
        const base = defaultSite();
        setDraft(base);
        setSaved(base);
        setFlash("Contenido restaurado.");
        setTimeout(() => setFlash(null), 3000);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo restaurar.");
      }
    });
  };

  return (
    <div className="pb-28">
      {/* Pestañas del editor */}
      <div className="rail -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`u-mono min-h-11 whitespace-nowrap rounded-full border-[1.5px] px-4 transition-colors ${
              tab === t.id ? "border-ink bg-ink text-paper" : "border-ink/20 bg-white text-ink/65"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        {tab === "carrusel" ? (
          <>
            <Note>
              Cada slide es una pantalla del carrusel. Tiene dos imágenes: la <b>foto principal</b>,
              que va grande al lado del texto y reemplaza al vaso dibujado, y el <b>fondo</b>, que
              va detrás de todo y admite video. Si dejas una vacía, se dibuja la ilustración.
            </Note>
            {draft.slides.map((s, i) => (
              <Panel
                key={s.id}
                title={`${s.title} ${s.accent}`}
                meta={s.kicker}
                onRemove={
                  draft.slides.length > 1
                    ? () =>
                        set(
                          "slides",
                          draft.slides.filter((_, j) => j !== i),
                        )
                    : undefined
                }
              >
                {(() => {
                  const upd = (patch: Partial<(typeof draft.slides)[number]>) =>
                    set(
                      "slides",
                      draft.slides.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                    );
                  return (
                    <>
                      <Row>
                        <Text
                          label="Antetítulo"
                          value={s.kicker}
                          onChange={(v) => upd({ kicker: v })}
                        />
                        <Color label="Color" value={s.tone} onChange={(v) => upd({ tone: v })} />
                      </Row>
                      <Row>
                        <Text
                          label="Título"
                          value={s.title}
                          onChange={(v) => upd({ title: v })}
                          hint="Primera línea, en negro"
                        />
                        <Text
                          label="Palabra destacada"
                          value={s.accent}
                          onChange={(v) => upd({ accent: v })}
                          hint="Segunda línea, en cursiva y a color"
                        />
                      </Row>
                      <Area label="Texto" value={s.body} onChange={(v) => upd({ body: v })} />
                      <Row>
                        <Text
                          label="Texto del botón"
                          value={s.cta.label}
                          onChange={(v) => upd({ cta: { ...s.cta, label: v } })}
                        />
                        <Select
                          label="El botón lleva a"
                          value={s.cta.href}
                          onChange={(v) => upd({ cta: { ...s.cta, href: v } })}
                          options={[
                            { value: "#menu", label: "Menú" },
                            { value: "#del-dia", label: "Batidos del día" },
                            { value: "#constructor", label: "Arma tu blend" },
                            { value: "#tiendas", label: "Tiendas" },
                            { value: "#contacto", label: "Contacto" },
                          ]}
                        />
                      </Row>
                      <Media
                        label="Foto principal (la grande, encima del carrusel)"
                        value={s.art}
                        onChange={(v) => upd({ art: v })}
                      />
                      {s.art ? null : (
                        <Select
                          label="Recipiente ilustrado (se usa mientras no haya foto)"
                          value={s.vessel}
                          onChange={(v) => upd({ vessel: v as Vessel })}
                          options={VESSELS}
                        />
                      )}

                      <Media
                        label="Fondo: video o foto"
                        value={s.media}
                        onChange={(v) => upd({ media: v })}
                        allowVideo
                      />
                      {s.media ? (
                        <Range
                          label="Cuánto se ve el fondo"
                          value={s.mediaOpacity ?? 55}
                          onChange={(v) => upd({ mediaOpacity: v })}
                          hint="Bájalo si el titular cuesta leerse"
                        />
                      ) : null}
                    </>
                  );
                })()}
              </Panel>
            ))}
            <AddButton
              label="Añadir slide"
              onClick={() =>
                set("slides", [
                  ...draft.slides,
                  {
                    id: `slide-${Date.now().toString(36)}`,
                    kicker: "Nuevo",
                    title: "Título",
                    accent: "destacado",
                    body: "Cuenta de qué se trata.",
                    cta: { label: "Ver el menú", href: "#menu" },
                    tone: "#7B3FF2",
                    vessel: "cup",
                  },
                ])
              }
            />
          </>
        ) : null}

        {tab === "dia" ? (
          <>
            <Note>
              Elige las tres bebidas del día, su precio rebajado y cuántas quedan. Cuando llegue a
              cero, la tienda las muestra agotadas.
            </Note>
            {[0, 1, 2].map((slot) => {
              const id = draft.dailyIds[slot] ?? "";
              const offer = draft.dailyOffer[id] ?? { price: 0, left: 0, why: "" };
              const setOffer = (patch: Partial<typeof offer>) =>
                set("dailyOffer", { ...draft.dailyOffer, [id]: { ...offer, ...patch } });
              const product = draft.products.find((p) => p.id === id);
              return (
                <Panel
                  key={slot}
                  title={product ? product.name : `Puesto ${slot + 1}`}
                  meta={product ? `${money(offer.price)} · quedan ${offer.left}` : "Sin asignar"}
                  defaultOpen
                >
                  <Select
                    label="Bebida"
                    value={id}
                    onChange={(v) => {
                      const ids = [...draft.dailyIds];
                      ids[slot] = v;
                      set("dailyIds", ids);
                      if (!draft.dailyOffer[v]) {
                        const p = draft.products.find((x) => x.id === v);
                        set("dailyOffer", {
                          ...draft.dailyOffer,
                          [v]: {
                            price: Math.round(((p?.price ?? 15000) * 0.85) / 100) * 100,
                            left: 20,
                            why: "",
                          },
                        });
                      }
                    }}
                    options={[
                      { value: "", label: "— Sin asignar —" },
                      ...draft.products.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                  {product ? (
                    <>
                      <Row>
                        <Num
                          label="Precio del día"
                          value={offer.price}
                          step={100}
                          onChange={(v) => setOffer({ price: v })}
                          suffix={`normal ${money(product.price)}`}
                        />
                        <Num
                          label="Unidades que quedan"
                          value={offer.left}
                          onChange={(v) => setOffer({ left: v })}
                        />
                      </Row>
                      <Text
                        label="Por qué está de oferta"
                        value={offer.why}
                        onChange={(v) => setOffer({ why: v })}
                        placeholder="Llegó fruta esta mañana"
                      />
                    </>
                  ) : null}
                </Panel>
              );
            })}
          </>
        ) : null}

        {tab === "menu" ? (
          <>
            <Note>
              Todo lo que ve el cliente en el menú. Si subes una foto, reemplaza a la ilustración
              dibujada. Los toppings y los tamaños están en «Precios y adicionales».
            </Note>

            <Panel title="Categorías" meta={`${draft.categories.length} en el menú`}>
              {draft.categories.map((c, i) => {
                const used = draft.products.filter((p) => p.category === c.id).length;
                const upd = (patch: Partial<typeof c>) =>
                  set(
                    "categories",
                    draft.categories.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                  );
                return (
                  <div
                    key={c.id}
                    className="grid gap-3 border-t-[1.5px] border-ink/10 pt-3 first:border-0 first:pt-0"
                  >
                    <Row>
                      <Text label="Nombre" value={c.name} onChange={(v) => upd({ name: v })} />
                      <Text
                        label="Nota"
                        value={c.note}
                        onChange={(v) => upd({ note: v })}
                        hint="Sale bajo los filtros del menú"
                      />
                    </Row>
                    {/* Borrar una categoría con bebidas dentro las dejaría invisibles
                        en el menú, así que primero hay que vaciarla o moverlas. */}
                    <button
                      type="button"
                      disabled={used > 0 || draft.categories.length < 2}
                      onClick={() =>
                        set(
                          "categories",
                          draft.categories.filter((_, j) => j !== i),
                        )
                      }
                      className="u-mono min-h-11 justify-self-start rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/45 transition-colors hover:border-mango-deep hover:text-mango-deep disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {used > 0 ? `No se puede: tiene ${used} bebida(s)` : "Eliminar categoría"}
                    </button>
                  </div>
                );
              })}
              <AddButton
                label="Añadir categoría"
                onClick={() => set("categories", [...draft.categories, blankCategory()])}
              />
            </Panel>

            {draft.categories.map((c) => (
              <div key={c.id} className="mt-2">
                <p className="u-mono mb-2 text-ink/45">
                  {c.name} · {draft.products.filter((p) => p.category === c.id).length}
                </p>
                <div className="grid gap-2">
                  {draft.products
                    .map((p, index) => ({ p, index }))
                    .filter(({ p }) => p.category === c.id)
                    .map(({ p, index }) => {
                      const upd = (patch: Partial<typeof p>) =>
                        set(
                          "products",
                          draft.products.map((x, j) => (j === index ? { ...x, ...patch } : x)),
                        );
                      return (
                        <Panel
                          key={p.id}
                          title={p.name}
                          meta={`${money(p.price)}${p.soldOut ? " · agotado" : ""}`}
                          onRemove={() => {
                            set(
                              "products",
                              draft.products.filter((_, j) => j !== index),
                            );
                            set(
                              "dailyIds",
                              draft.dailyIds.filter((x) => x !== p.id),
                            );
                          }}
                        >
                          <Row>
                            <Text
                              label="Nombre"
                              value={p.name}
                              onChange={(v) => upd({ name: v })}
                            />
                            <Num
                              label="Precio"
                              value={p.price}
                              step={100}
                              onChange={(v) => upd({ price: v })}
                            />
                          </Row>
                          <Area
                            label="Descripción"
                            value={p.tagline}
                            rows={2}
                            onChange={(v) => upd({ tagline: v })}
                          />
                          <Row cols={3}>
                            <Select
                              label="Categoría"
                              value={p.category}
                              onChange={(v) => upd({ category: v })}
                              options={draft.categories.map((x) => ({
                                value: x.id,
                                label: x.name,
                              }))}
                            />
                            <Num label="Kcal" value={p.kcal} onChange={(v) => upd({ kcal: v })} />
                            <Select
                              label="Recipiente"
                              value={p.vessel}
                              onChange={(v) => upd({ vessel: v as Vessel })}
                              options={VESSELS}
                            />
                          </Row>
                          <Row>
                            <Color
                              label="Color de la bebida"
                              value={p.color}
                              onChange={(v) => upd({ color: v })}
                            />
                            <Text
                              label="Etiqueta"
                              value={p.badge ?? ""}
                              onChange={(v) => upd({ badge: v || undefined })}
                              hint="Más pedido, Nuevo, De temporada…"
                            />
                          </Row>
                          <Toggle
                            label="Agotado"
                            value={Boolean(p.soldOut)}
                            onChange={(v) => upd({ soldOut: v || undefined })}
                            hint="No se puede pedir mientras esté marcado"
                          />
                          <StringList
                            label="Ingredientes que se ven en la ficha"
                            values={p.ingredients.map((x) => x.name)}
                            addLabel="Añadir ingrediente"
                            onChange={(names) =>
                              upd({
                                ingredients: names.map((name, k) => ({
                                  name,
                                  color: p.ingredients[k]?.color ?? p.color,
                                })),
                              })
                            }
                          />
                          <Media
                            label="Foto del producto"
                            value={p.media}
                            onChange={(v) => upd({ media: v })}
                          />
                        </Panel>
                      );
                    })}
                </div>
                <AddButton
                  label={`Añadir en ${c.name}`}
                  onClick={() => set("products", [...draft.products, blankProduct(c.id)])}
                />
              </div>
            ))}
          </>
        ) : null}

        {tab === "precios" ? (
          <>
            <Note>
              Los precios que no son de una bebida concreta. Se cobran desde el servidor, así que lo
              que pongas aquí es exactamente lo que paga el cliente.
            </Note>

            <Panel
              title="Adicionales"
              meta={`${draft.toppings.length} · se suman al precio de la bebida`}
              defaultOpen
            >
              {draft.toppings.map((t, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Text
                      label="Nombre"
                      value={t.name}
                      onChange={(v) =>
                        set(
                          "toppings",
                          draft.toppings.map((x, j) => (j === i ? { ...x, name: v } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="w-32 shrink-0">
                    <Num
                      label="Precio"
                      value={t.price}
                      step={100}
                      onChange={(v) =>
                        set(
                          "toppings",
                          draft.toppings.map((x, j) => (j === i ? { ...x, price: v } : x)),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "toppings",
                        draft.toppings.filter((_, j) => j !== i),
                      )
                    }
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20 text-ink/50 transition-colors hover:border-mango-deep hover:text-mango-deep"
                    aria-label={`Quitar ${t.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <AddButton
                label="Añadir adicional"
                onClick={() =>
                  set("toppings", [...draft.toppings, { name: "Adicional", price: 3000 }])
                }
              />
              <p className="u-mono normal-case tracking-[0.01em] text-ink/35">
                Si le cambias el nombre a uno, los carritos que ya lo tenían dejan de cobrarlo. Es a
                propósito: nunca se cobra algo que ya no existe.
              </p>
            </Panel>

            <Panel
              title="Tamaños"
              meta={draft.sizes.map((s) => s.label).join(" · ") || "Ninguno"}
              defaultOpen
            >
              {draft.sizes.map((s, i) => {
                const upd = (patch: Partial<typeof s>) =>
                  set(
                    "sizes",
                    draft.sizes.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                  );
                return (
                  <div
                    key={s.id}
                    className="grid gap-3 border-t-[1.5px] border-ink/10 pt-3 first:border-0 first:pt-0"
                  >
                    <Row cols={3}>
                      <Text label="Nombre" value={s.label} onChange={(v) => upd({ label: v })} />
                      <Text
                        label="Volumen"
                        value={s.volume}
                        onChange={(v) => upd({ volume: v })}
                        hint="350 ml, 16 oz…"
                      />
                      <Num
                        label="Suma al precio"
                        value={s.delta}
                        step={100}
                        onChange={(v) => upd({ delta: v })}
                      />
                    </Row>
                    {draft.sizes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "sizes",
                            draft.sizes.filter((_, j) => j !== i),
                          )
                        }
                        className="u-mono min-h-11 justify-self-start rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/45 transition-colors hover:border-mango-deep hover:text-mango-deep"
                      >
                        Eliminar tamaño
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <AddButton
                label="Añadir tamaño"
                onClick={() =>
                  set("sizes", [
                    ...draft.sizes,
                    {
                      id: `tam-${Date.now().toString(36)}`,
                      label: "Tamaño nuevo",
                      volume: "700 ml",
                      delta: 6000,
                    },
                  ])
                }
              />
              <p className="u-mono normal-case tracking-[0.01em] text-ink/35">
                El primero de la lista es el que viene marcado por defecto.
              </p>
            </Panel>

            <Panel
              title="Domicilio"
              meta={`${money(draft.pricing.delivery.fee)} · gratis desde ${money(draft.pricing.delivery.freeFrom)}`}
              defaultOpen
            >
              <Row>
                <Num
                  label="Costo del domicilio"
                  value={draft.pricing.delivery.fee}
                  step={100}
                  onChange={(v) =>
                    set("pricing", {
                      ...draft.pricing,
                      delivery: { ...draft.pricing.delivery, fee: v },
                    })
                  }
                />
                <Num
                  label="Gratis a partir de"
                  value={draft.pricing.delivery.freeFrom}
                  step={1000}
                  onChange={(v) =>
                    set("pricing", {
                      ...draft.pricing,
                      delivery: { ...draft.pricing.delivery, freeFrom: Math.max(1, v) },
                    })
                  }
                />
              </Row>
            </Panel>

            <Panel title="Arma tu blend" meta={`Desde ${money(draft.pricing.builder.base)}`}>
              <Row>
                <Num
                  label="Precio con dos ingredientes"
                  value={draft.pricing.builder.base}
                  step={100}
                  onChange={(v) =>
                    set("pricing", {
                      ...draft.pricing,
                      builder: { ...draft.pricing.builder, base: v },
                    })
                  }
                />
                <Num
                  label="Recargo por el tercero"
                  value={draft.pricing.builder.perExtra}
                  step={100}
                  onChange={(v) =>
                    set("pricing", {
                      ...draft.pricing,
                      builder: { ...draft.pricing.builder, perExtra: v },
                    })
                  }
                />
              </Row>
            </Panel>
          </>
        ) : null}

        {tab === "textos" ? (
          <>
            <Note>
              Los encabezados de cada sección. El título va en negro y la palabra destacada en
              cursiva a color.
            </Note>
            {(Object.keys(draft.sections) as SectionKey[]).map((key) => {
              const s = draft.sections[key];
              const upd = (patch: Partial<typeof s>) =>
                set("sections", { ...draft.sections, [key]: { ...s, ...patch } });
              return (
                <Panel key={key} title={SECTION_LABEL[key]} meta={`${s.title} ${s.accent}`}>
                  <Text
                    label="Antetítulo"
                    value={s.eyebrow}
                    onChange={(v) => upd({ eyebrow: v })}
                  />
                  <Row>
                    <Text label="Título" value={s.title} onChange={(v) => upd({ title: v })} />
                    <Text
                      label="Palabra destacada"
                      value={s.accent}
                      onChange={(v) => upd({ accent: v })}
                    />
                  </Row>
                  <Area label="Texto" value={s.body} onChange={(v) => upd({ body: v })} />
                  <Media
                    label="Imagen de la sección"
                    value={s.image}
                    onChange={(v) => upd({ image: v })}
                  />
                </Panel>
              );
            })}

            <Panel title="Cómo llega tu pedido" meta="Los tres pasos">
              {draft.processSteps.map((s, i) => (
                <div
                  key={i}
                  className="grid gap-3 border-t-[1.5px] border-ink/10 pt-3 first:border-0 first:pt-0"
                >
                  <Row>
                    <Text
                      label={`Paso ${i + 1}`}
                      value={s.title}
                      onChange={(v) =>
                        set(
                          "processSteps",
                          draft.processSteps.map((x, j) => (j === i ? { ...x, title: v } : x)),
                        )
                      }
                    />
                    <Color
                      label="Color"
                      value={s.color}
                      onChange={(v) =>
                        set(
                          "processSteps",
                          draft.processSteps.map((x, j) => (j === i ? { ...x, color: v } : x)),
                        )
                      }
                    />
                  </Row>
                  <Area
                    label="Texto"
                    value={s.body}
                    rows={2}
                    onChange={(v) =>
                      set(
                        "processSteps",
                        draft.processSteps.map((x, j) => (j === i ? { ...x, body: v } : x)),
                      )
                    }
                  />
                </div>
              ))}
            </Panel>

            <Panel title="Sellos" meta={`${draft.rewards.filled} de ${draft.rewards.stamps}`}>
              <Text
                label="Antetítulo"
                value={draft.rewards.eyebrow}
                onChange={(v) => set("rewards", { ...draft.rewards, eyebrow: v })}
              />
              <Row>
                <Text
                  label="Título"
                  value={draft.rewards.title}
                  onChange={(v) => set("rewards", { ...draft.rewards, title: v })}
                />
                <Text
                  label="Palabra destacada"
                  value={draft.rewards.accent}
                  onChange={(v) => set("rewards", { ...draft.rewards, accent: v })}
                />
              </Row>
              <Area
                label="Texto"
                value={draft.rewards.body}
                rows={2}
                onChange={(v) => set("rewards", { ...draft.rewards, body: v })}
              />
              <Row>
                <Num
                  label="Sellos para el premio"
                  value={draft.rewards.stamps}
                  min={2}
                  onChange={(v) => set("rewards", { ...draft.rewards, stamps: Math.min(12, v) })}
                />
                <Num
                  label="Sellos de ejemplo"
                  value={draft.rewards.filled}
                  onChange={(v) =>
                    set("rewards", {
                      ...draft.rewards,
                      filled: Math.min(v, draft.rewards.stamps),
                    })
                  }
                />
              </Row>
            </Panel>

            <Panel title="Preguntas frecuentes" meta={`${draft.faqs.length} preguntas`}>
              {draft.faqs.map((f, i) => (
                <div
                  key={i}
                  className="grid gap-3 border-t-[1.5px] border-ink/10 pt-3 first:border-0 first:pt-0"
                >
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Text
                        label="Pregunta"
                        value={f.q}
                        onChange={(v) =>
                          set(
                            "faqs",
                            draft.faqs.map((x, j) => (j === i ? { ...x, q: v } : x)),
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "faqs",
                          draft.faqs.filter((_, j) => j !== i),
                        )
                      }
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/20 text-ink/50 transition-colors hover:border-mango-deep hover:text-mango-deep"
                      aria-label="Quitar pregunta"
                    >
                      ×
                    </button>
                  </div>
                  <Area
                    label="Respuesta"
                    value={f.a}
                    rows={2}
                    onChange={(v) =>
                      set(
                        "faqs",
                        draft.faqs.map((x, j) => (j === i ? { ...x, a: v } : x)),
                      )
                    }
                  />
                </div>
              ))}
              <AddButton
                label="Añadir pregunta"
                onClick={() => set("faqs", [...draft.faqs, { q: "", a: "" }])}
              />
            </Panel>
          </>
        ) : null}

        {tab === "tiendas" ? (
          <>
            <Note>
              Las coordenadas ubican la sede en el mapa real y también en el ilustrado, que es el
              que se ve si el mapa no carga.
            </Note>
            {draft.stores.map((s, i) => {
              const upd = (patch: Partial<typeof s>) =>
                set(
                  "stores",
                  draft.stores.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                );
              return (
                <Panel
                  key={s.id}
                  title={s.name}
                  meta={s.address}
                  onRemove={
                    draft.stores.length > 1
                      ? () =>
                          set(
                            "stores",
                            draft.stores.filter((_, j) => j !== i),
                          )
                      : undefined
                  }
                >
                  <Row>
                    <Text label="Nombre" value={s.name} onChange={(v) => upd({ name: v })} />
                    <Text
                      label="Zona"
                      value={s.area}
                      onChange={(v) => upd({ area: v })}
                      hint="Es la etiqueta del pin en el mapa"
                    />
                  </Row>
                  <Text label="Dirección" value={s.address} onChange={(v) => upd({ address: v })} />
                  <Row>
                    <Text label="Horario" value={s.hours} onChange={(v) => upd({ hours: v })} />
                    <Text label="Teléfono" value={s.phone} onChange={(v) => upd({ phone: v })} />
                  </Row>
                  <Row>
                    <Text
                      label="Latitud"
                      value={String(s.lat)}
                      onChange={(v) => upd({ lat: Number(v) || s.lat })}
                    />
                    <Text
                      label="Longitud"
                      value={String(s.lng)}
                      onChange={(v) => upd({ lng: Number(v) || s.lng })}
                    />
                  </Row>
                  <p className="u-mono normal-case tracking-[0.01em] text-ink/35">
                    Sácalas de Google Maps: clic derecho sobre el punto y copia los dos números.
                  </p>
                  <StringList
                    label="Servicios"
                    values={s.services}
                    addLabel="Añadir servicio"
                    onChange={(v) => upd({ services: v })}
                  />
                </Panel>
              );
            })}
            <AddButton
              label="Añadir sede"
              onClick={() => set("stores", [...draft.stores, blankStore()])}
            />
          </>
        ) : null}

        {tab === "marca" ? (
          <>
            <Panel title="Datos de la marca" defaultOpen>
              <Row>
                <Text
                  label="Nombre"
                  value={draft.brand.name}
                  onChange={(v) => set("brand", { ...draft.brand, name: v })}
                />
                <Text
                  label="Ciudad"
                  value={draft.brand.city}
                  onChange={(v) => set("brand", { ...draft.brand, city: v })}
                />
              </Row>
              <Text
                label="Descripción corta"
                value={draft.brand.tagline}
                onChange={(v) => set("brand", { ...draft.brand, tagline: v })}
              />
              <Media
                label="Logo"
                value={draft.brand.logo || undefined}
                onChange={(v) => set("brand", { ...draft.brand, logo: v ?? "" })}
              />
              <Row cols={3}>
                <Text
                  label="Teléfono"
                  value={draft.brand.phone}
                  onChange={(v) => set("brand", { ...draft.brand, phone: v })}
                />
                <Text
                  label="Correo"
                  value={draft.brand.email}
                  onChange={(v) => set("brand", { ...draft.brand, email: v })}
                />
                <Text
                  label="Instagram"
                  value={draft.brand.instagram}
                  onChange={(v) => set("brand", { ...draft.brand, instagram: v })}
                />
              </Row>
              <Text
                label="Promesa de entrega"
                value={draft.brand.delivery}
                onChange={(v) => set("brand", { ...draft.brand, delivery: v })}
                hint="Aparece bajo el carrusel"
              />
            </Panel>

            <Panel title="Cinta superior" meta={`${draft.marquee.length} mensajes`} defaultOpen>
              <StringList
                label="Mensajes que giran arriba"
                values={draft.marquee}
                addLabel="Añadir mensaje"
                onChange={(v) => set("marquee", v)}
              />
            </Panel>

            <Panel title="Bases y frutas" meta="Para «Arma tu blend» y la personalización">
              <StringList
                label="Bases"
                values={draft.builderBases.map((b) => b.name)}
                addLabel="Añadir base"
                onChange={(names) =>
                  set(
                    "builderBases",
                    names.map((name, k) => ({
                      name,
                      color: draft.builderBases[k]?.color ?? "#F0E6D6",
                    })),
                  )
                }
              />
              <StringList
                label="Ingredientes"
                values={draft.builderIngredients.map((b) => b.name)}
                addLabel="Añadir ingrediente"
                onChange={(names) =>
                  set(
                    "builderIngredients",
                    names.map((name, k) => ({
                      name,
                      color: draft.builderIngredients[k]?.color ?? "#FFB020",
                    })),
                  )
                }
              />
            </Panel>
          </>
        ) : null}
      </div>

      {/* Barra de guardado, siempre a la vista */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-[1.5px] border-ink bg-paper/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2">
          <p className="u-mono min-w-0 flex-1 normal-case tracking-[0.01em] text-ink/50">
            {error ? (
              <span className="text-mango-deep">{error}</span>
            ) : flash ? (
              <span className="text-matcha-deep">{flash}</span>
            ) : pending ? (
              "Publicando…"
            ) : dirty ? (
              "Cambios sin publicar"
            ) : customized ? (
              `Publicado · ${sizeKb(saved)} KB en la base`
            ) : (
              "Contenido original"
            )}
          </p>

          <div className="flex items-center gap-2">
            {customized || dirty ? (
              <button
                type="button"
                onClick={restore}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/45 transition-colors hover:border-mango-deep hover:text-mango-deep"
              >
                Restaurar
              </button>
            ) : null}
            {dirty ? (
              <button
                type="button"
                onClick={discard}
                className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
              >
                Descartar
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || pending}
              className="btn btn-sm btn-mango disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="u-mono rounded-2xl border-[1.5px] border-ink/12 bg-white px-4 py-3 normal-case tracking-[0.01em] text-ink/50">
      {children}
    </p>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="u-mono mt-2 min-h-11 w-full rounded-2xl border-[1.5px] border-dashed border-ink/25 px-4 text-ink/50 transition-colors hover:border-ink hover:text-ink"
    >
      + {label}
    </button>
  );
}

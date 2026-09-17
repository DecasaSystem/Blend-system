import "server-only";
import type { FunctionTool } from "openai/resources/responses/responses";
import type { SiteContent } from "./site";
import { money, priceOf } from "./cart";

/**
 * El asistente de la tienda: lo que sabe y lo que puede hacer.
 *
 * Todo lo que sabe sale del contenido publicado (`site_content`) en el
 * momento de cada mensaje: si el equipo cambia un precio o agota una bebida,
 * el asistente lo dice al siguiente mensaje sin redeploy. No hay búsqueda ni
 * índice porque el menú es corto: cabe entero en las instrucciones y así el
 * modelo lo ve completo cuando recomienda.
 *
 * Lo que puede hacer son herramientas que en realidad corren en el navegador
 * del cliente (mover la página, abrir una ficha, agregar al carrito). El
 * servidor las valida y las manda como eventos; el cliente las ejecuta.
 */

/** Las secciones de la portada a las que puede llevar al cliente. */
export const SECTIONS: Record<string, string> = {
  top: "arriba del todo, la portada",
  "del-dia": "las bebidas del día con precio especial",
  menu: "el menú completo, con filtros por categoría",
  constructor: "«Arma tu blend»: el cliente elige base e ingredientes",
  tiendas: "las sedes, con mapa, horario y cómo llegar",
  app: "cómo instalar la tienda como app en el teléfono",
  contacto: "formulario de contacto, teléfono e Instagram",
};

/** Las páginas a las que puede mandar al cliente. */
export const PAGES: Record<string, string> = {
  "/": "la portada con el menú",
  "/checkout": "cerrar el pedido y pagar",
  "/cuenta": "su cuenta: pedidos, sellos, direcciones y el mapa del domicilio en camino",
  "/cuenta/entrar": "entrar o crear cuenta",
};

export type AssistantContext = {
  /** Ruta donde está el cliente ahora mismo. */
  page: string;
  /** Lo que ya tiene en el carrito. */
  cart: { name: string; qty: number }[];
  /** Si tiene sesión: cómo se llama y cómo van sus últimos pedidos. */
  customer: { name: string; orders: string[] } | null;
};

export function buildInstructions(site: SiteContent, ctx: AssistantContext): string {
  const { brand, stores, categories, products, sizes, toppings, pricing, dailyIds, dailyOffer } =
    site;
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const sizeLabels = sizes.map((s) => `${s.label} (${s.volume})`).join(" y ");

  const menu = products
    .map((p) => {
      const prices = sizes
        .map((s) => `${s.label.toLowerCase()} ${money(priceOf(p, s.id, sizes))}`)
        .join(" / ");
      const bits = [
        `id=${p.id}`,
        p.name,
        catName(p.category),
        prices,
        `lleva: ${p.ingredients.map((i) => i.name).join(", ")}`,
        `«${p.tagline}»`,
      ];
      if (p.badge) bits.push(`etiqueta: ${p.badge}`);
      if (p.soldOut) bits.push("AGOTADO hoy: no se puede pedir");
      const oferta = dailyIds.includes(p.id) ? dailyOffer[p.id] : null;
      if (oferta) {
        bits.push(
          `DEL DÍA: ${money(oferta.price)} el ${sizes[0]?.label.toLowerCase() ?? "chico"}, quedan ${oferta.left}${oferta.why ? ` (${oferta.why})` : ""}`,
        );
      }
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");

  const sedes = stores
    .map(
      (s) =>
        `- ${s.name} (${s.area}): ${s.address}. Horario ${s.hours}. Tel. ${s.phone}.${
          s.services.length ? ` ${s.services.join(", ")}.` : ""
        }`,
    )
    .join("\n");

  const extras = toppings.map((t) => `${t.name} (+${money(t.price)})`).join(", ");
  const bases = site.builderBases.map((b) => b.name).join(", ");
  const ingredientes = site.builderIngredients.map((i) => i.name).join(", ");
  const faqs = site.faqs.map((f) => `- ${f.q} → ${f.a}`).join("\n");
  const pasos = site.processSteps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join("\n");

  const carrito = ctx.cart.length
    ? ctx.cart.map((l) => `${l.qty}× ${l.name}`).join(", ")
    : "vacío";

  const cliente = ctx.customer
    ? `Tiene cuenta y se llama ${ctx.customer.name}.${
        ctx.customer.orders.length
          ? ` Sus últimos pedidos: ${ctx.customer.orders.join("; ")}.`
          : " Todavía no ha pedido."
      }`
    : "No ha iniciado sesión. Puede pedir sin cuenta; con cuenta suma sellos, guarda direcciones y puede chatear con la barra y ver el domicilio en el mapa.";

  return `Eres el asistente de ${brand.name}, ${brand.tagline.toLowerCase()} en ${brand.city}, Colombia. Atiendes a los clientes en la tienda en línea.

# Cómo hablas
- Español colombiano, cercano, tuteando. Frases cortas; dos a cuatro por respuesta salvo que pidan detalle. Sin listas largas si con una recomendación basta.
- Recomienda con criterio: pregunta por gustos (dulce, ácido, con o sin leche, cafeína, saciante) si no los sabes, y propón una o dos opciones concretas con precio.
- Sólo sabes lo que está aquí. Si te preguntan algo que no está (ingredientes que no se listan, si algo tiene trazas de frutos secos, tiempos exactos de un pedido concreto, reclamos), dilo claro y ofrece dos salidas: la pestaña «La barra» de este mismo chat (responde una persona; hace falta cuenta) o llamar al ${brand.phone}.
- Nunca inventes precios, descuentos, promociones ni horarios. Los precios de abajo son los vigentes.
- Alergias: di exactamente qué lleva cada bebida según la lista y aclara que se preparan en la misma barra.

# Herramientas
Puedes mover la página y el carrito del cliente. Úsalas cuando ayuden a lo que pide, no por hablar:
- \`ir_a\`: lleva al cliente a una sección de la portada. Úsala cuando hables de algo que está ahí (el menú, las sedes, cómo instalar la app).
- \`abrir_producto\`: abre la ficha de una bebida para que la vea y la personalice. Úsala al recomendar una bebida concreta.
- \`agregar_al_carrito\`: sólo cuando el cliente lo pida de forma clara («agrégame», «pídeme», «quiero uno de esos»). No agregues por iniciativa propia. No agregues bebidas agotadas.
- \`abrir_carrito\` y \`ir_a_pagina\`: para revisar el pedido, pagar, entrar a la cuenta.
Después de usar una herramienta, di en una frase lo que hiciste («Te abrí la ficha del Mango Terco»). Si la herramienta responde que no se pudo, explícalo y ofrece la alternativa.

# Dónde está el cliente
Página actual: ${ctx.page} (${PAGES[ctx.page] ?? "otra página"}). Su carrito: ${carrito}. ${cliente}

# La marca
${brand.name} — ${brand.tagline}. ${brand.delivery}. Teléfono ${brand.phone}, correo ${brand.email}, Instagram ${brand.instagram}.

# Sedes
${sedes}

# Pedidos, domicilio y pago
- Se pide en línea desde la portada: se agrega al carrito, y en «Pagar» se elige recoger en una sede o domicilio.
- Domicilio en ${brand.city}: cuesta ${money(pricing.delivery.fee)} y es gratis desde ${money(pricing.delivery.freeFrom)} de pedido. Los domicilios se pagan en línea.
- Pago en línea por Bold: tarjeta de crédito o débito, PSE, Nequi o Botón Bancolombia. Para recoger también se puede pagar en la sede.
- Tamaños: ${sizeLabels}. Adicionales: ${extras || "ninguno"}.
- Cuando el pedido va en camino, el cliente con cuenta ve al repartidor moverse en el mapa desde /cuenta y puede escribirle desde este chat.
- Sellos: ${site.rewards.body} Cada ${site.rewards.stamps} pedidos entregados, uno va por la casa.

# «Arma tu blend» (sección constructor)
Precio ${money(pricing.builder.base)} con hasta ${site.builder.included} ingredientes; cada uno de más suma ${money(pricing.builder.perExtra)}; máximo ${site.builder.max}. Bases: ${bases}. Ingredientes: ${ingredientes}.

# Cómo se prepara
${pasos}

# Menú (usa el id exacto en las herramientas)
Categorías: ${categories.map((c) => `${c.name} — ${c.note}`).join("; ")}.
${menu}

# Preguntas frecuentes
${faqs}`;
}

/** Las herramientas, en el formato de la API de Responses (esquema estricto). */
export function buildTools(site: SiteContent): FunctionTool[] {
  const productIds = site.products.map((p) => p.id);
  const sizeIds = site.sizes.map((s) => s.id);
  return [
    {
      type: "function",
      name: "ir_a",
      description: "Desplaza la portada hasta una sección. Si el cliente está en otra página, lo lleva a la portada.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          seccion: {
            type: "string",
            enum: Object.keys(SECTIONS),
            description: Object.entries(SECTIONS)
              .map(([k, v]) => `${k}: ${v}`)
              .join("; "),
          },
        },
        required: ["seccion"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "abrir_producto",
      description: "Abre la ficha de una bebida del menú, donde el cliente la ve y elige tamaño y adicionales.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", enum: productIds, description: "El id de la bebida, tal cual está en el menú." },
        },
        required: ["productId"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "agregar_al_carrito",
      description:
        "Agrega una bebida al carrito del cliente, con las opciones por defecto. Sólo si el cliente lo pidió de forma clara.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", enum: productIds },
          sizeId: {
            type: ["string", "null"],
            enum: [...sizeIds, null],
            description: "Tamaño. Null para el más pequeño.",
          },
          qty: { type: ["integer", "null"], description: "Cuántas. Null para una." },
        },
        required: ["productId", "sizeId", "qty"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "abrir_carrito",
      description: "Abre el carrito para que el cliente revise su pedido.",
      strict: true,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      type: "function",
      name: "ir_a_pagina",
      description: "Lleva al cliente a otra página del sitio.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          ruta: {
            type: "string",
            enum: Object.keys(PAGES),
            description: Object.entries(PAGES)
              .map(([k, v]) => `${k}: ${v}`)
              .join("; "),
          },
        },
        required: ["ruta"],
        additionalProperties: false,
      },
    },
  ];
}

/** Lo que el navegador ejecuta cuando el modelo llama una herramienta. */
export type AssistantAction =
  | { name: "ir_a"; seccion: string }
  | { name: "abrir_producto"; productId: string }
  | { name: "agregar_al_carrito"; productId: string; sizeId: string | null; qty: number }
  | { name: "abrir_carrito" }
  | { name: "ir_a_pagina"; ruta: string };

/**
 * Valida una llamada del modelo y decide qué se le contesta. La acción sale
 * hacia el navegador sólo si es válida; el texto vuelve al modelo para que
 * sepa qué pasó y lo cuente.
 */
export function resolveCall(
  site: SiteContent,
  ctx: AssistantContext,
  name: string,
  args: unknown,
): { action: AssistantAction | null; output: string } {
  const a = (args ?? {}) as Record<string, unknown>;
  const home = ctx.page === "/";
  const product = (id: unknown) =>
    typeof id === "string" ? site.products.find((p) => p.id === id) : undefined;

  switch (name) {
    case "ir_a": {
      const seccion = String(a.seccion ?? "");
      if (!(seccion in SECTIONS)) return { action: null, output: "Esa sección no existe." };
      return {
        action: { name, seccion },
        output: home
          ? `Hecho: la página se desplazó a «${seccion}».`
          : `Hecho: el cliente estaba en ${ctx.page}; se le llevó a la portada, a «${seccion}».`,
      };
    }
    case "abrir_producto": {
      const p = product(a.productId);
      if (!p) return { action: null, output: "No existe una bebida con ese id." };
      return {
        action: { name, productId: p.id },
        output: home
          ? `Hecho: se abrió la ficha de ${p.name}.`
          : `Hecho: el cliente estaba en ${ctx.page}; se le llevó a la portada y se abrió la ficha de ${p.name}.`,
      };
    }
    case "agregar_al_carrito": {
      const p = product(a.productId);
      if (!p) return { action: null, output: "No existe una bebida con ese id." };
      if (p.soldOut) return { action: null, output: `${p.name} está agotada hoy; no se agregó.` };
      const sizeId =
        typeof a.sizeId === "string" && site.sizes.some((s) => s.id === a.sizeId)
          ? a.sizeId
          : (site.sizes[0]?.id ?? null);
      const qty = Math.min(10, Math.max(1, Math.floor(Number(a.qty) || 1)));
      const size = site.sizes.find((s) => s.id === sizeId);
      return {
        action: { name, productId: p.id, sizeId, qty },
        output: `Hecho: ${qty}× ${p.name}${size ? ` ${size.label.toLowerCase()}` : ""} en el carrito, a ${money(priceOf(p, sizeId ?? undefined, site.sizes))} cada una.${
          home ? "" : " El cliente estaba en otra página; se le llevó a la portada."
        }`,
      };
    }
    case "abrir_carrito":
      return {
        action: { name },
        output: home
          ? "Hecho: el carrito está abierto."
          : "Hecho: el cliente estaba en otra página; se le llevó a la portada con el carrito abierto.",
      };
    case "ir_a_pagina": {
      const ruta = String(a.ruta ?? "");
      if (!(ruta in PAGES)) return { action: null, output: "Esa página no existe." };
      return { action: { name, ruta }, output: `Hecho: el cliente va a ${ruta}.` };
    }
    default:
      return { action: null, output: "Herramienta desconocida." };
  }
}

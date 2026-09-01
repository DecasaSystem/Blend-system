"use server";

import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { loadSiteContent } from "./content";

/**
 * Métricas de la barra.
 *
 * Se leen los pedidos del periodo y se suman aquí, no en SQL: las líneas viven
 * en `jsonb`, así que contar toppings o tamaños desde Postgres sería una
 * consulta ilegible para lo que en un local de batidos son unos miles de filas.
 *
 * Qué cuenta como venta: todo pedido que no esté en `pago`. Un pedido que
 * espera que entre la plata todavía no es una venta, y si nunca se cobra
 * tampoco lo será.
 *
 * Las fechas se agrupan en hora de Colombia, no en UTC: si no, los pedidos de
 * después de las 7 de la tarde se irían al día siguiente.
 */

const ZONE = "America/Bogota";

export type Punto = { fecha: string; etiqueta: string; ventas: number; pedidos: number };
export type Fila = { nombre: string; valor: number; extra?: number };

export type Stats = {
  dias: number;
  vacio: boolean;
  resumen: {
    ventas: number;
    pedidos: number;
    ticket: number;
    unidades: number;
    /** El mismo tramo, justo antes. Sirve para el «vs» de cada tarjeta. */
    ventasAntes: number;
    pedidosAntes: number;
  };
  porDia: Punto[];
  topProductos: Fila[];
  topAdicionales: Fila[];
  porHora: { hora: number; pedidos: number }[];
  modo: Fila[];
  pago: Fila[];
  tamanos: Fila[];
  bases: Fila[];
  tiendas: Fila[];
};

/** Clave `2026-08-31` en hora de Colombia. */
const claveDia = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const horaLocal = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", hour12: false }).format(d),
  );

const etiquetaDia = (clave: string) => {
  // Mediodía para que el desfase horario no mueva el día al formatear.
  const d = new Date(`${clave}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short" })
    .format(d)
    .replace(".", "");
};

/** Ordena de mayor a menor y deja los primeros; el resto se resume en «Otros». */
function top(mapa: Map<string, { valor: number; extra: number }>, limite: number): Fila[] {
  const filas = [...mapa.entries()]
    .map(([nombre, v]) => ({ nombre, valor: v.valor, extra: v.extra }))
    .sort((a, b) => b.valor - a.valor);

  if (filas.length <= limite) return filas;

  const resto = filas.slice(limite);
  return [
    ...filas.slice(0, limite),
    {
      nombre: `Otros (${resto.length})`,
      valor: resto.reduce((n, f) => n + f.valor, 0),
      extra: resto.reduce((n, f) => n + f.extra, 0),
    },
  ];
}

function suma(
  mapa: Map<string, { valor: number; extra: number }>,
  clave: string,
  valor: number,
  extra = 0,
) {
  const actual = mapa.get(clave) ?? { valor: 0, extra: 0 };
  mapa.set(clave, { valor: actual.valor + valor, extra: actual.extra + extra });
}

export async function loadStats(dias: number): Promise<Stats> {
  await requireUser();

  const rango = Math.max(1, Math.min(365, Math.floor(dias) || 7));
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - rango * 24 * 60 * 60 * 1000);
  // El tramo anterior, del mismo largo, para poder decir «vs. los 7 días antes».
  const desdeAntes = new Date(ahora.getTime() - rango * 2 * 24 * 60 * 60 * 1000);

  const site = await loadSiteContent();

  const filas = await db
    .select({
      createdAt: orders.createdAt,
      total: orders.total,
      lines: orders.lines,
      mode: orders.mode,
      storeId: orders.storeId,
      payment: orders.payment,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, desdeAntes), sql`${orders.status} <> 'pago'`))
    .orderBy(orders.createdAt);

  const actuales = filas.filter((o) => o.createdAt >= desde);
  const previos = filas.filter((o) => o.createdAt < desde);

  // Todos los días del rango, incluidos los que no vendieron nada: un hueco en
  // la línea diría «no hay dato» cuando lo que hubo fue cero.
  const dias0 = new Map<string, { ventas: number; pedidos: number }>();
  for (let i = rango - 1; i >= 0; i--) {
    dias0.set(claveDia(new Date(ahora.getTime() - i * 24 * 60 * 60 * 1000)), {
      ventas: 0,
      pedidos: 0,
    });
  }

  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, pedidos: 0 }));
  const productos = new Map<string, { valor: number; extra: number }>();
  const adicionales = new Map<string, { valor: number; extra: number }>();
  const tamanos = new Map<string, { valor: number; extra: number }>();
  const bases = new Map<string, { valor: number; extra: number }>();
  const tiendas = new Map<string, { valor: number; extra: number }>();
  const modo = { envio: 0, recoger: 0 };
  const pago = { tarjeta: 0, efectivo: 0, pendiente: 0 };

  let ventas = 0;
  let unidades = 0;

  for (const o of actuales) {
    ventas += o.total;

    const clave = claveDia(o.createdAt);
    const dia = dias0.get(clave);
    if (dia) {
      dia.ventas += o.total;
      dia.pedidos += 1;
    }

    horas[horaLocal(o.createdAt)].pedidos += 1;
    modo[o.mode] += 1;
    pago[o.payment] += 1;

    const tienda = site.stores.find((s) => s.id === o.storeId)?.name ?? o.storeId;
    suma(tiendas, tienda, 1, o.total);

    for (const l of o.lines) {
      const q = l.qty ?? 1;
      unidades += q;
      // Un blend armado a mano no es un producto del catálogo: se agrupan todos
      // juntos, porque cada combinación es distinta y ninguna se repite.
      suma(productos, l.custom ? "Blend armado" : l.name, q, q * l.unitPrice);

      const opciones = l.options;
      if (!opciones) continue;
      for (const extra of opciones.extras) suma(adicionales, extra, q);

      // El tamaño se guarda por id; el nombre puede haber cambiado desde
      // entonces, y si el equipo lo borró se muestra el id tal cual.
      const tam = site.sizes.find((s) => s.id === opciones.size);
      suma(tamanos, tam ? tam.label : opciones.size, q);
      if (opciones.base) suma(bases, opciones.base, q);
    }
  }

  const pedidos = actuales.length;

  return {
    dias: rango,
    vacio: pedidos === 0,
    resumen: {
      ventas,
      pedidos,
      ticket: pedidos ? Math.round(ventas / pedidos) : 0,
      unidades,
      ventasAntes: previos.reduce((n, o) => n + o.total, 0),
      pedidosAntes: previos.length,
    },
    porDia: [...dias0.entries()].map(([fecha, v]) => ({
      fecha,
      etiqueta: etiquetaDia(fecha),
      ventas: v.ventas,
      pedidos: v.pedidos,
    })),
    topProductos: top(productos, 8).map((f) => ({
      nombre: f.nombre,
      valor: f.valor,
      extra: f.extra,
    })),
    topAdicionales: top(adicionales, 8),
    porHora: horas,
    modo: [
      { nombre: "A domicilio", valor: modo.envio },
      { nombre: "Recoger", valor: modo.recoger },
    ],
    pago: [
      { nombre: "Tarjeta", valor: pago.tarjeta },
      { nombre: "Efectivo", valor: pago.efectivo },
      { nombre: "Sin pagar", valor: pago.pendiente },
    ],
    tamanos: top(tamanos, 6),
    bases: top(bases, 6),
    tiendas: top(tiendas, 6),
  };
}

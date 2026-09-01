"use client";

import { useEffect, useState, useTransition } from "react";
import { Barras, Card, Columnas, Empty, LineaVentas, Reparto, Tile } from "./charts";
import { loadStats, type Fila, type Stats } from "@/actions/stats";
import { money } from "@/lib/cart";

/**
 * Métricas de la barra.
 *
 * Un solo filtro de periodo, arriba y fuera de las tarjetas: todo lo de abajo
 * se vuelve a pintar contra el mismo tramo, así que los números siempre cuadran
 * entre sí. Mientras recarga, lo anterior se queda a media opacidad en vez de
 * desaparecer: sin saltos de maquetación ni esqueletos parpadeando.
 *
 * Cada gráfico tiene su gemelo en tabla, para quien no distinga los colores o
 * quiera copiar las cifras.
 */

const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
] as const;

/** Variación porcentual contra el tramo anterior. Nulo si antes no hubo nada. */
function delta(ahora: number, antes: number) {
  if (!antes) return null;
  return Math.round(((ahora - antes) / antes) * 100);
}

export default function StatsPanel() {
  const [dias, setDias] = useState<number>(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabla, setTabla] = useState(false);
  const [cargando, empezar] = useTransition();

  useEffect(() => {
    empezar(async () => {
      try {
        setStats(await loadStats(dias));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las métricas.");
      }
    });
  }, [dias]);

  if (error) {
    return <p className="u-mono py-10 text-center text-mango-deep">{error}</p>;
  }

  if (!stats) {
    return <p className="u-mono py-16 text-center text-ink/35">Cargando métricas…</p>;
  }

  const r = stats.resumen;

  return (
    <div>
      {/* Una sola fila de filtros, encima de todo lo que afecta */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1 rounded-full border-[1.5px] border-ink p-1"
          role="tablist"
        >
          {RANGOS.map((v) => (
            <button
              key={v.dias}
              type="button"
              role="tab"
              aria-selected={dias === v.dias}
              onClick={() => setDias(v.dias)}
              className={`u-mono min-h-9 rounded-full px-3.5 transition-colors ${
                dias === v.dias ? "bg-ink text-paper" : "text-ink/55"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTabla((v) => !v)}
          aria-pressed={tabla}
          className={`u-mono min-h-11 rounded-full border-[1.5px] px-3.5 transition-colors ${
            tabla ? "border-ink bg-ink text-paper" : "border-ink/25 text-ink/60 hover:border-ink"
          }`}
        >
          {tabla ? "Ver gráficos" : "Ver tablas"}
        </button>

        <p className="u-mono ml-auto normal-case tracking-[0.01em] text-ink/40">
          Sin contar los pedidos que esperan pago
        </p>
      </div>

      <div className={cargando ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {stats.vacio ? (
          <p className="u-mono mt-16 text-center normal-case tracking-[0.01em] text-ink/35">
            No hay pedidos en este periodo. Prueba con un rango más largo.
          </p>
        ) : (
          <>
            {/* Las cuatro cifras de cabecera */}
            <dl className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Tile
                label="Ventas"
                value={money(r.ventas)}
                delta={delta(r.ventas, r.ventasAntes)}
                hint={`En ${stats.dias} días`}
              />
              <Tile
                label="Pedidos"
                value={String(r.pedidos)}
                delta={delta(r.pedidos, r.pedidosAntes)}
              />
              <Tile label="Ticket promedio" value={money(r.ticket)} hint="Ventas entre pedidos" />
              <Tile
                label="Bebidas servidas"
                value={String(r.unidades)}
                hint="Unidades, no líneas"
              />
            </dl>

            {tabla ? (
              <Tablas stats={stats} />
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Card title="Ventas por día" hint="Pasa el cursor para ver el día" wide>
                  <LineaVentas datos={stats.porDia} />
                </Card>

                <Card title="Lo que más se vende" hint="Unidades · y lo que dejó cada una">
                  {stats.topProductos.length ? (
                    <Barras datos={stats.topProductos} formato={(n) => `${n} u.`} />
                  ) : (
                    <Empty>Todavía nada.</Empty>
                  )}
                </Card>

                <Card title="Adicionales más pedidos" hint="Veces que se añadieron">
                  {stats.topAdicionales.length ? (
                    <Barras datos={stats.topAdicionales} formato={(n) => `${n}×`} />
                  ) : (
                    <Empty>Nadie ha añadido nada todavía.</Empty>
                  )}
                </Card>

                <Card title="A qué hora piden" hint="Pedidos por hora, hora de Colombia" wide>
                  <Columnas datos={stats.porHora} />
                </Card>

                <Card title="Cómo lo reciben">
                  <Reparto datos={stats.modo} />
                </Card>

                <Card title="Cómo pagan">
                  <Reparto datos={stats.pago} />
                </Card>

                <Card title="Tamaños">
                  {stats.tamanos.length ? (
                    <Barras datos={stats.tamanos} formato={(n) => `${n}×`} />
                  ) : (
                    <Empty>Todavía nada.</Empty>
                  )}
                </Card>

                <Card title="Bases">
                  {stats.bases.length ? (
                    <Barras datos={stats.bases} formato={(n) => `${n}×`} />
                  ) : (
                    <Empty>Todavía nada.</Empty>
                  )}
                </Card>

                <Card title="Por tienda" hint="Pedidos · y lo que vendió cada una" wide>
                  {stats.tiendas.length ? (
                    <Barras
                      datos={stats.tiendas}
                      formato={(n) => `${n} ${n === 1 ? "pedido" : "pedidos"}`}
                    />
                  ) : (
                    <Empty>Todavía nada.</Empty>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tablas({ stats }: { stats: Stats }) {
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <Tabla
        title="Ventas por día"
        cols={["Día", "Ventas", "Pedidos"]}
        filas={stats.porDia.map((d) => [d.etiqueta, money(d.ventas), String(d.pedidos)])}
        wide
      />
      <Tabla
        title="Lo que más se vende"
        cols={["Bebida", "Unidades", "Ventas"]}
        filas={stats.topProductos.map((d) => [d.nombre, String(d.valor), money(d.extra ?? 0)])}
      />
      <Tabla
        title="Adicionales más pedidos"
        cols={["Adicional", "Veces"]}
        filas={stats.topAdicionales.map((d) => [d.nombre, String(d.valor)])}
      />
      <Tabla
        title="A qué hora piden"
        cols={["Hora", "Pedidos"]}
        filas={stats.porHora
          .filter((h) => h.pedidos > 0)
          .map((h) => [`${String(h.hora).padStart(2, "0")}:00`, String(h.pedidos)])}
      />
      <Tabla
        title="Cómo lo reciben"
        cols={["Modo", "Pedidos"]}
        filas={stats.modo.map((d: Fila) => [d.nombre, String(d.valor)])}
      />
      <Tabla
        title="Cómo pagan"
        cols={["Pago", "Pedidos"]}
        filas={stats.pago.map((d: Fila) => [d.nombre, String(d.valor)])}
      />
      <Tabla
        title="Tamaños"
        cols={["Tamaño", "Veces"]}
        filas={stats.tamanos.map((d: Fila) => [d.nombre, String(d.valor)])}
      />
      <Tabla
        title="Bases"
        cols={["Base", "Veces"]}
        filas={stats.bases.map((d: Fila) => [d.nombre, String(d.valor)])}
      />
      <Tabla
        title="Por tienda"
        cols={["Tienda", "Pedidos", "Ventas"]}
        filas={stats.tiendas.map((d: Fila) => [d.nombre, String(d.valor), money(d.extra ?? 0)])}
        wide
      />
    </div>
  );
}

function Tabla({
  title,
  cols,
  filas,
  wide = false,
}: {
  title: string;
  cols: string[];
  filas: string[][];
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4 sm:p-5 ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <h3 className="text-[1.05rem] font-semibold leading-tight">{title}</h3>
      {filas.length === 0 ? (
        <Empty>Todavía nada.</Empty>
      ) : (
        // Las tablas anchas se desplazan dentro de su tarjeta, no en la página.
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-[1.5px] border-ink/10">
                {cols.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={`u-mono pb-2 font-medium text-ink/40 ${i ? "text-right" : ""}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {filas.map((f, i) => (
                <tr key={i} className="border-b border-ink/[0.06] last:border-0">
                  {f.map((celda, j) => (
                    <td
                      key={j}
                      className={`py-2 text-[0.9rem] ${j ? "text-right text-ink/70" : ""}`}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

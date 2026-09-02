"use client";

import { useId, useState } from "react";
import { money } from "@/lib/cart";

/**
 * Gráficos de la vista de equipo.
 *
 * SVG a mano, sin librería: los cuatro tipos que hacen falta ocupan menos que
 * cualquier paquete de gráficos y no añaden 300 KB al bundle de la barra.
 *
 * Reglas que siguen todos, y por qué:
 *  - Marcas finas y rejilla de un solo pelo: el dato es lo único que grita.
 *  - Punta redondeada arriba, cuadrada en la línea base, de la que siempre
 *    arrancan: una barra que no nace en cero miente sobre su tamaño.
 *  - Los huecos de 2 px entre barras son del color del fondo, no un borde:
 *    un contorno alrededor de la marca añade tinta que no es dato.
 *  - El texto nunca lleva el color de la serie; la identidad la da la marca
 *    de al lado. Un verde claro como texto no se lee.
 *
 * La paleta está validada para daltonismo (protanopía y deuteranopía al 100%):
 * el peor par contiguo queda en ΔE 32 sobre blanco. El orden importa — el
 * morado entre el naranja y el verde es lo que los separa — así que los
 * segmentos se pintan en este orden y no en otro.
 */

export const SERIE = ["#D84A00", "#7B3FF2", "#4E9B34"] as const;

const REJILLA = "#E4DAF2";
const EJE = "#8A7BA0";

/** Redondea hacia arriba a algo legible: 0 / 5.000 / 10.000. */
function techo(max: number) {
  if (max <= 0) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitud) * magnitud;
}

const compacto = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "")}k`
      : String(n);

/* ------------------------------------------------------------------ */
/* Tarjeta y envoltorio                                                */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  hint,
  children,
  wide = false,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4 sm:p-5 ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <h3 className="text-[1.05rem] font-semibold leading-tight">{title}</h3>
      {hint ? (
        <p className="u-mono mt-1 normal-case tracking-[0.01em] text-ink/40">{hint}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="u-mono grid place-items-center px-3 py-10 text-center normal-case tracking-[0.01em] text-ink/35">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta de dato suelto                                              */
/* ------------------------------------------------------------------ */

export function Tile({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  /** Variación contra el tramo anterior, en porcentaje. */
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border-[1.5px] border-ink/15 bg-white p-4">
      <p className="u-mono text-ink/45">{label}</p>
      {/* Cifras proporcionales: `tabular-nums` deja suelto un número grande. */}
      <p className="mt-1.5 text-[1.75rem] font-semibold leading-none">{value}</p>
      {delta === null || delta === undefined ? (
        hint ? (
          <p className="u-mono mt-2 text-ink/35">{hint}</p>
        ) : null
      ) : (
        <p className="u-mono mt-2 flex items-center gap-1.5 text-ink/45">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: delta >= 0 ? "#4E9B34" : "#D84A00" }}
          />
          {delta >= 0 ? "+" : ""}
          {delta}% vs. antes
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Línea + área: ventas por día                                        */
/* ------------------------------------------------------------------ */

type Punto = { etiqueta: string; ventas: number; pedidos: number };

export function LineaVentas({ datos }: { datos: Punto[] }) {
  const uid = useId();
  const [activo, setActivo] = useState<number | null>(null);

  // Muy apaisado a propósito: el SVG escala con el ancho de la tarjeta, y con
  // una proporción más cuadrada el relleno del área se comía media pantalla.
  const W = 1000;
  const H = 220;
  const P = { top: 16, right: 20, bottom: 28, left: 52 };
  const ancho = W - P.left - P.right;
  const alto = H - P.top - P.bottom;

  const max = techo(Math.max(...datos.map((d) => d.ventas), 1));
  const x = (i: number) =>
    P.left + (datos.length === 1 ? ancho / 2 : (i / (datos.length - 1)) * ancho);
  const y = (v: number) => P.top + alto - (v / max) * alto;

  const linea = datos.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.ventas)}`).join(" ");
  const area = `${linea} L${x(datos.length - 1)},${P.top + alto} L${x(0)},${P.top + alto} Z`;
  const ticks = [0, max / 2, max];
  const punto = activo === null ? null : datos[activo];

  // Con muchos días no caben todas las fechas: se rotulan unas pocas.
  const cada = Math.ceil(datos.length / 8);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label="Ventas por día"
        onPointerLeave={() => setActivo(null)}
        onPointerMove={(e) => {
          const caja = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - caja.left) / caja.width) * W;
          const i = Math.round(((px - P.left) / ancho) * (datos.length - 1));
          setActivo(Math.max(0, Math.min(datos.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={P.left}
              x2={W - P.right}
              y1={y(t)}
              y2={y(t)}
              stroke={REJILLA}
              strokeWidth="1"
            />
            <text
              x={P.left - 10}
              y={y(t) + 4}
              textAnchor="end"
              fill={EJE}
              fontSize="10"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {compacto(t)}
            </text>
          </g>
        ))}

        <path d={area} fill={SERIE[0]} opacity="0.1" />
        <path
          d={linea}
          fill="none"
          stroke={SERIE[0]}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Sólo el último punto lleva marca fija: un punto por día sería ruido. */}
        <circle
          cx={x(datos.length - 1)}
          cy={y(datos[datos.length - 1].ventas)}
          r="4.5"
          fill={SERIE[0]}
          stroke="#fff"
          strokeWidth="2"
        />

        {/* Las de los extremos se anclan hacia dentro; centradas se salen del lienzo. */}
        {datos.map((d, i) =>
          i % cada === 0 || i === datos.length - 1 ? (
            <text
              key={`${uid}-${i}`}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === datos.length - 1 ? "end" : "middle"}
              fill={EJE}
              fontSize="10"
            >
              {d.etiqueta}
            </text>
          ) : null,
        )}

        {/* El puntero apunta a un día, no a una línea de 2 px. */}
        {activo !== null ? (
          <g>
            <line
              x1={x(activo)}
              x2={x(activo)}
              y1={P.top}
              y2={P.top + alto}
              stroke={EJE}
              strokeWidth="1"
            />
            <circle
              cx={x(activo)}
              cy={y(datos[activo].ventas)}
              r="5"
              fill={SERIE[0]}
              stroke="#fff"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>

      {/* Sigue al día señalado. Se ancla por la izquierda o por la derecha
          según de qué mitad venga, para no salirse de la tarjeta. */}
      {punto && activo !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-xl border-[1.5px] border-ink/15 bg-white px-3 py-2 shadow-[2px_3px_0_0_rgba(27,11,46,0.10)]"
          style={
            x(activo) > W / 2
              ? { right: `${100 - (x(activo) / W) * 100}%`, marginRight: "10px" }
              : { left: `${(x(activo) / W) * 100}%`, marginLeft: "10px" }
          }
        >
          {/* El valor manda; el día lo acompaña. */}
          <p className="text-[0.95rem] font-semibold leading-none">{money(punto.ventas)}</p>
          <p className="u-mono mt-1 normal-case tracking-[0.01em] text-ink/45">
            {punto.etiqueta} · {punto.pedidos} {punto.pedidos === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras horizontales: lo que más se vende, adicionales…              */
/* ------------------------------------------------------------------ */

type Fila = { nombre: string; valor: number; extra?: number };

export function Barras({
  datos,
  formato = (n: number) => String(n),
  hue = SERIE[0],
}: {
  datos: Fila[];
  formato?: (n: number) => string;
  /** Una sola serie: todas las barras del mismo color. */
  hue?: string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <ul className="grid gap-2.5">
      {datos.map((d) => (
        <li key={d.nombre}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[0.9rem]">{d.nombre}</span>
            <span
              className="u-mono shrink-0 text-ink/60"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formato(d.valor)}
            </span>
          </div>
          {/* La barra nace en cero y la punta se redondea sólo por fuera. */}
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
            <div
              className="h-full rounded-r-full"
              style={{ width: `${Math.max(2, (d.valor / max) * 100)}%`, background: hue }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Columnas: pedidos por hora                                          */
/* ------------------------------------------------------------------ */

export function Columnas({ datos }: { datos: { hora: number; pedidos: number }[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(...datos.map((d) => d.pedidos), 1);

  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]" onPointerLeave={() => setActivo(null)}>
        {datos.map((d) => (
          <button
            key={d.hora}
            type="button"
            onPointerEnter={() => setActivo(d.hora)}
            onFocus={() => setActivo(d.hora)}
            onBlur={() => setActivo(null)}
            // El área sensible es toda la columna, no sólo la parte pintada.
            className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
            aria-label={`${d.hora}:00 · ${d.pedidos} pedidos`}
          >
            {/* Tope de 24 px: una columna que llena su hueco lee como un bloque. */}
            <span
              className="w-full max-w-[24px] rounded-t transition-opacity group-hover:opacity-75"
              style={{
                height: `${Math.max(d.pedidos ? 3 : 0, (d.pedidos / max) * 100)}%`,
                background: SERIE[0],
              }}
            />
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-[2px]">
        {datos.map((d) => (
          <span
            key={d.hora}
            className="u-mono min-w-0 flex-1 text-center text-[0.5rem] text-ink/35"
          >
            {d.hora % 6 === 0 ? d.hora : ""}
          </span>
        ))}
      </div>

      <p className="u-mono mt-2 normal-case tracking-[0.01em] text-ink/45">
        {activo === null
          ? "Hora del día, de 0 a 23"
          : `${String(activo).padStart(2, "0")}:00 — ${datos[activo].pedidos} ${
              datos[activo].pedidos === 1 ? "pedido" : "pedidos"
            }`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barra apilada: reparto entre dos o tres opciones                    */
/* ------------------------------------------------------------------ */

export function Reparto({ datos }: { datos: Fila[] }) {
  // El color se ata a la posición original, no a la de la lista ya filtrada:
  // si un día no hay pagos en efectivo, «Sin pagar» no puede heredar su color.
  // Quien aprendió que el morado es «Recoger» seguiría viendo morado y leería
  // otra cosa.
  const filas = datos
    .map((d, orden) => ({ ...d, tono: SERIE[orden % SERIE.length] }))
    .filter((d) => d.valor > 0);

  const total = filas.reduce((n, d) => n + d.valor, 0);
  if (total === 0) return <Empty>Todavía no hay pedidos que repartir.</Empty>;

  return (
    <div>
      {/* El hueco de 2 px es lo que separa los segmentos; no llevan borde. */}
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-full">
        {filas.map((d) => (
          <span
            key={d.nombre}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(d.valor / total) * 100}%`, background: d.tono }}
          />
        ))}
      </div>

      {/* Leyenda siempre presente: la identidad nunca depende sólo del color. */}
      <ul className="mt-3 grid gap-1.5">
        {filas.map((d) => (
          <li key={d.nombre} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: d.tono }}
            />
            <span className="min-w-0 flex-1 truncate text-[0.9rem]">{d.nombre}</span>
            <span
              className="u-mono shrink-0 text-ink/60"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round((d.valor / total) * 100)}% · {d.valor}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

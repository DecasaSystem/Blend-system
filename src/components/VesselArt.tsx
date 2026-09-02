import type { Ingredient, Vessel } from "@/lib/content";
import { mediaSrcSet, mediaUrl } from "@/lib/media";

/**
 * Ilustración del producto. No usamos fotos de stock: cada bebida se dibuja con
 * su recipiente real y los ingredientes sobreimpresos dentro.
 * Si el equipo sube una foto (`media`), esta ilustración se reemplaza.
 *
 * Todos los recipientes ocupan una franja vertical parecida (y ≈ 60–250) para que
 * en la rejilla del menú un bowl no se vea diminuto al lado de un vaso.
 */

type Shape = {
  body: string;
  /** Tapa o base, se dibuja encima del cuerpo. */
  extra?: { d: string; filled: boolean };
  straw?: boolean;
  /** Altura de la superficie del líquido dentro del recipiente. */
  fill: number;
  label: string;
};

const VESSELS: Record<Vessel, Shape> = {
  cup: {
    body: "M57 80 L143 80 L132 236 C131.4 243 125.8 248 119 248 L81 248 C74.2 248 68.6 243 68 236 Z",
    extra: {
      d: "M46 58 L154 58 C158 58 161 61 161 65 L161 74 C161 78 158 81 154 81 L46 81 C42 81 39 78 39 74 L39 65 C39 61 42 58 46 58 Z",
      filled: true,
    },
    straw: true,
    fill: 118,
    label: "vaso para llevar",
  },
  chawan: {
    body: "M34 98 L166 98 C166 190 136 242 100 242 C64 242 34 190 34 98 Z",
    extra: { d: "M76 250 L124 250", filled: false },
    fill: 118,
    label: "chawan",
  },
  bowl: {
    body: "M24 92 L176 92 C176 194 141 248 100 248 C59 248 24 194 24 92 Z",
    extra: { d: "M70 256 L130 256", filled: false },
    fill: 112,
    label: "bowl",
  },
  glass: {
    body: "M63 66 L137 66 L127 240 C126.7 245 122.8 248 118 248 L82 248 C77.2 248 73.3 245 73 240 Z",
    fill: 104,
    label: "vaso",
  },
  bottle: {
    body: "M85 66 L115 66 L115 92 C133 104 139 118 139 138 L139 228 C139 236 132.5 242 125 242 L75 242 C67.5 242 61 236 61 228 L61 138 C61 118 67 104 85 92 Z",
    extra: { d: "M80 48 L120 48 L120 68 L80 68 Z", filled: true },
    fill: 128,
    label: "botella",
  },
};

export default function VesselArt({
  uid,
  vessel,
  color,
  ingredients,
  media,
  width = 400,
  className = "",
  alt,
  outline = "#1B0B2E",
  empty = "#fffdfb",
}: {
  uid: string;
  vessel: Vessel;
  color: string;
  ingredients: Ingredient[];
  media?: string;
  /** A cuántos píxeles se va a ver, para no bajar una foto más grande que eso. */
  width?: number;
  className?: string;
  alt?: string;
  /** Color del trazo. En fondos oscuros hay que pasar uno claro. */
  outline?: string;
  /** Color del aire sobre el líquido. Debe combinar con el fondo del recipiente. */
  empty?: string;
}) {
  if (media) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      /* `object-contain`, no `cover`: la foto de un producto es el producto
         entero. Recortarla para llenar la caja le corta la tapa o el popote. */
      <img
        src={mediaUrl(media, { width })}
        srcSet={mediaSrcSet(media, width)}
        alt={alt ?? ""}
        className={`h-full w-full object-contain ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const shape = VESSELS[vessel];
  const clip = `clip-${uid}`;

  const spots = ingredients.slice(0, 3).map((ing, i) => ({
    ...ing,
    cx: [78, 126, 100][i] ?? 100,
    cy: [162, 194, 224][i] ?? 196,
    r: [50, 42, 36][i] ?? 40,
  }));

  return (
    <svg
      viewBox="0 0 200 268"
      className={className}
      role="img"
      aria-label={alt ?? `Ilustración de ${shape.label}`}
    >
      <defs>
        <clipPath id={clip}>
          <path d={shape.body} />
        </clipPath>
      </defs>

      {/* Popote: va detrás del vaso para que la tapa lo tape por abajo */}
      {shape.straw ? (
        <>
          <path
            d="M116 70 L134 16"
            fill="none"
            stroke={outline}
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M116 70 L134 16"
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </>
      ) : null}

      <path d={shape.body} fill={color} />

      <g clipPath={`url(#${clip})`} style={{ mixBlendMode: "multiply" }}>
        {spots.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={s.color}
            opacity={0.55}
            className="drift"
            style={{ animationDelay: `${i * -4.3}s`, transformOrigin: `${s.cx}px ${s.cy}px` }}
          />
        ))}
      </g>

      {/* Aire sobre el líquido + brillo */}
      <g clipPath={`url(#${clip})`}>
        <path
          d={`M0 ${shape.fill} C 38 ${shape.fill - 13}, 62 ${shape.fill + 12}, 100 ${shape.fill} C 138 ${shape.fill - 12}, 162 ${shape.fill + 13}, 200 ${shape.fill} L200 0 L0 0 Z`}
          fill={empty}
        />
        <ellipse cx="74" cy={shape.fill + 58} rx="14" ry="28" fill="#fffdfb" opacity="0.18" />
      </g>

      <path d={shape.body} fill="none" stroke={outline} strokeWidth="3.5" strokeLinejoin="round" />

      {shape.extra ? (
        <path
          d={shape.extra.d}
          fill={shape.extra.filled ? empty : "none"}
          stroke={outline}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

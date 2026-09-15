import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand, categories } from "@/lib/content";

/**
 * Imagen que sale al compartir el enlace en WhatsApp, Instagram o Google.
 *
 * Antes la metadata apuntaba a `/og.png`, que no existía: el enlace se
 * compartía sin foto. Se dibuja aquí con el sistema visual del sitio (papel,
 * tinta, el logo de la marca) y se genera una vez en el build: usa
 * el contenido de fábrica y no la base, para que nunca dependa de ella.
 */

export const alt = `${brand.name} — ${brand.tagline} en ${brand.city}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1b0b2e";
const PAPER = "#f7f1ff";

export default async function Image() {
  // Se lee del disco en el build (la imagen es estática); `fetch(new URL(…,
  // import.meta.url))`, que es lo que sugiere la documentación, no está
  // implementado en Turbopack para archivos locales.
  const [bold, medium, logo] = await Promise.all([
    readFile(join(process.cwd(), "src", "app", "_og", "Poppins-Bold.ttf")),
    readFile(join(process.cwd(), "src", "app", "_og", "Poppins-Medium.ttf")),
    // El logo real de la marca (el mismo del favicon), no una ilustración.
    readFile(join(process.cwd(), "src", "app", "_og", "logo.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  // Lo que la gente busca; «Extras» no es una búsqueda.
  const pills = [
    ...categories.filter((c) => c.id !== "extras").map((c) => c.name),
    "Smoothies",
    "Jugos naturales",
    "Crispetas",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: PAPER,
          color: INK,
          fontFamily: "Poppins",
          border: `6px solid ${INK}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={132} height={132} alt="" style={{ borderRadius: 30 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 0.95, letterSpacing: -4 }}>
              {brand.name}
            </div>
            <div style={{ fontSize: 34, fontWeight: 500, marginTop: 10, opacity: 0.75 }}>
              {`${brand.tagline} · ${brand.city}, Quindío`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {pills.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  border: `3px solid ${INK}`,
                  borderRadius: 999,
                  background: "#fffdfb",
                  boxShadow: `3px 4px 0 0 ${INK}`,
                  fontSize: 26,
                  fontWeight: 500,
                }}
              >
                {p}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 28,
              fontWeight: 500,
            }}
          >
            <span>Fruta congelada, nunca hielo. Pide en línea.</span>
            <span
              style={{
                display: "flex",
                padding: "12px 26px",
                borderRadius: 999,
                background: "#ff6a1a",
                color: "#fff",
                border: `3px solid ${INK}`,
                whiteSpace: "nowrap",
              }}
            >
              {brand.delivery}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Poppins", data: bold, style: "normal", weight: 700 },
        { name: "Poppins", data: medium, style: "normal", weight: 500 },
      ],
    },
  );
}


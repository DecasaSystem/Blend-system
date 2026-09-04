/**
 * Inyecta datos estructurados para Google sin tocar el diseño.
 *
 * Un <script type="application/ld+json"> en el <head>: invisible para la
 * persona, legible para el buscador. Acepta uno o varios grafos.
 */
export default function SeoJsonLd({ data }: { data: unknown | unknown[] }) {
  const graphs = Array.isArray(data) ? data : [data];
  return (
    <>
      {graphs.map((g, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(g) }}
        />
      ))}
    </>
  );
}

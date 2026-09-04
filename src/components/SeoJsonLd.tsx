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
          // `.replace(/</g, "<")` es obligatorio, no cosmético: JSON.stringify
          // no escapa "<", así que un texto editado desde /equipo (una respuesta de
          // FAQ, un tagline) que contenga literalmente "</script>" cerraría esta
          // etiqueta en medio del HTML y dejaría que el navegador ejecute lo que
          // venga después como un <script> nuevo. < sigue siendo JSON válido
          // -decodifica de vuelta a "<"- pero ya no forma esa secuencia en el HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(g).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}

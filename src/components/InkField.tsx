/**
 * Elemento firma: manchas de tinta que se sobreimprimen.
 * Donde el naranja cruza el morado aparece un tercer color — la marca, literalmente.
 */

type Blob = {
  color: string;
  size: number; // % del ancho del contenedor
  x: number; // %
  y: number; // %
  delay?: number;
  opacity?: number;
};

export default function InkField({
  blobs,
  tone = "light",
  className = "",
}: {
  blobs: Blob[];
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={`ink-field ${className}`} data-tone={tone} aria-hidden="true">
      {blobs.map((b, i) => (
        <span
          key={i}
          className="ink-blob drift"
          style={{
            background: b.color,
            width: `${b.size}%`,
            aspectRatio: "1",
            left: `${b.x}%`,
            top: `${b.y}%`,
            opacity: b.opacity ?? (tone === "dark" ? 0.5 : 0.72),
            animationDelay: `${b.delay ?? i * -3.7}s`,
          }}
        />
      ))}
    </div>
  );
}

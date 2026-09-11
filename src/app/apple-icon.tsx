import { ImageResponse } from "next/og";

/**
 * Icono de 180×180 para iPhone («Añadir a inicio») y para el manifest.
 * Las tres tintas del logo sobre papel, con esquinas que iOS redondea solo.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f7f1ff",
          position: "relative",
        }}
      >
        <div style={dot(28, 28, "#ff6a1a")} />
        <div style={dot(78, 32, "#7b3ff2", 0.9)} />
        <div style={dot(53, 78, "#8fd14f", 0.9)} />
      </div>
    ),
    size,
  );
}

function dot(left: number, top: number, fill: string, opacity = 1) {
  return {
    position: "absolute" as const,
    left,
    top,
    width: 74,
    height: 74,
    borderRadius: 999,
    background: fill,
    opacity,
    border: "5px solid #1b0b2e",
  };
}

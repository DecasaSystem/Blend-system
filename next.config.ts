import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * - Nadie puede meter la tienda en un iframe: sin esto, otra página podría
 *   poner /equipo invisible encima de la suya y hacer que la barra pulse
 *   «borrar pedidos» creyendo que pulsa otra cosa (clickjacking).
 * - El navegador no adivina tipos de archivo: un archivo subido no se
 *   ejecuta como script porque «parezca» uno.
 * - Al salir a otro sitio sólo viaja el dominio, no la ruta con `?pedido=`.
 * - La ubicación sólo la pide la propia tienda (el repartidor en la moto);
 *   cámara y micrófono, nadie.
 *
 * No hay Content-Security-Policy completa a propósito: Google, Bold,
 * Cloudinary y los mapas cargan cosas de varios dominios y una lista mal
 * hecha rompe el pago sin avisar. Es el siguiente paso, probándola antes en
 * modo «report-only».
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

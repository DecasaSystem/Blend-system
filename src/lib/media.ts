/**
 * Entrega de fotos y videos.
 *
 * En la base sólo se guarda la URL que devuelve Cloudinary, limpia y sin
 * recortes. El tamaño y el formato se deciden aquí, al pintar: la misma foto
 * sale a 400 px en la rejilla del menú y a 1600 px de fondo del carrusel, sin
 * volver a subir nada.
 *
 * Qué hace cada transformación:
 *   f_auto  — WebP o AVIF si el navegador los entiende, JPEG si no. Suele
 *             ahorrar la mitad del peso sin que se note en pantalla.
 *   q_auto  — Cloudinary mira la imagen y baja la calidad justo hasta donde el
 *             ojo no lo distingue. Por eso "buena calidad" no cuesta lentitud.
 *   c_limit — Reduce si es más grande, pero nunca amplía ni recorta.
 *
 * Las URLs que no son de Cloudinary (una pegada a mano, o las fotos antiguas
 * guardadas como data URL) pasan de largo sin tocarse.
 */

const UPLOAD = "/upload/";
const CLOUDINARY_HOST = "https://res.cloudinary.com/";

/** El equipo pega la URL de un video o de una foto en el mismo campo. */
export function isVideoUrl(src: string) {
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/video\//.test(src)) return true;
  return /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(src) || src.startsWith("data:video");
}

type Options = {
  /** Ancho máximo en píxeles a los que se va a ver. */
  width?: number;
};

export function mediaUrl(src: string | undefined, { width }: Options = {}): string | undefined {
  if (!src || !src.startsWith(CLOUDINARY_HOST)) return src;

  const at = src.indexOf(UPLOAD);
  if (at < 0) return src;

  const head = src.slice(0, at + UPLOAD.length);
  const rest = src.slice(at + UPLOAD.length);

  // Sólo se toca una URL recién salida de Cloudinary, que empieza por la
  // versión (`v1712…`). Si ya trae transformaciones, alguien las puso a mano y
  // no somos quiénes para pisarlas.
  if (!/^v\d+\//.test(rest)) return src;

  const t = ["f_auto", "q_auto"];
  if (width) t.push(`w_${width}`, "c_limit");

  return `${head}${t.join(",")}/${rest}`;
}

/**
 * `srcset` para pantallas retina: el navegador elige entre 1x y 2x según el
 * dispositivo, en vez de que todos carguen la grande.
 */
export function mediaSrcSet(src: string | undefined, width: number): string | undefined {
  if (!src || !src.startsWith(CLOUDINARY_HOST)) return undefined;
  const one = mediaUrl(src, { width });
  const two = mediaUrl(src, { width: width * 2 });
  if (!one || !two || one === src) return undefined;
  return `${one} 1x, ${two} 2x`;
}

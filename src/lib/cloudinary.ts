import "server-only";

import { createHash } from "node:crypto";

/**
 * Cloudinary — donde viven las fotos y los videos de la tienda.
 *
 * No hay SDK a propósito, igual que con la pasarela de pagos: subir es un POST
 * con formulario y una firma, así que todo lo que la app sabe de Cloudinary
 * cabe en este archivo.
 *
 * El archivo NO pasa por el servidor. El navegador pide aquí una firma, y con
 * ella sube directo a Cloudinary. Un video de 60 MB atravesando una función
 * serverless sería lento, caro y chocaría con el límite del cuerpo; así el
 * servidor sólo mueve unos cientos de bytes.
 *
 * El secreto nunca sale de aquí: sólo viaja la firma, que sirve para una
 * subida y caduca.
 *
 * https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

/** Carpeta donde se agrupa todo, para no ensuciar la raíz de la cuenta. */
export const MEDIA_FOLDER = "blend";

/** Sin claves la tienda sigue en pie: el editor deja pegar URLs y nada más. */
export function cloudinaryEnabled() {
  return Boolean(cloudName && apiKey && apiSecret);
}

export type UploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

/**
 * Un permiso de subida de un solo uso.
 *
 * Cloudinary firma los parámetros ordenados alfabéticamente y unidos con `&`,
 * con el secreto pegado al final. El orden importa: si cambia, la firma no
 * cuadra y Cloudinary rechaza la subida.
 */
export function signUpload(): UploadTicket {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary no está configurado.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    folder: MEDIA_FOLDER,
    timestamp: String(timestamp),
  };

  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const signature = createHash("sha1")
    .update(toSign + apiSecret, "utf8")
    .digest("hex");

  return { cloudName, apiKey, timestamp, signature, folder: MEDIA_FOLDER };
}

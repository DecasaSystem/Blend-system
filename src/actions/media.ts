"use server";

import { cloudinaryEnabled, signUpload, type UploadTicket } from "@/lib/cloudinary";
import { requireUser } from "@/lib/session";

/**
 * Permiso para subir una foto o un video.
 *
 * Exige sesión de equipo: sin esto, cualquiera podría pedir firmas y llenar la
 * cuenta de Cloudinary con lo que quisiera.
 */
export async function requestUploadTicket(): Promise<UploadTicket | { error: string }> {
  await requireUser();

  if (!cloudinaryEnabled()) {
    return { error: "Cloudinary no está configurado. Pega la URL a mano por ahora." };
  }

  try {
    return signUpload();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo preparar la subida." };
  }
}

/** Para que el editor sepa si puede ofrecer el botón de subir. */
export async function mediaUploadsAvailable() {
  return cloudinaryEnabled();
}

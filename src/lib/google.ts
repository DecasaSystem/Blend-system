import "server-only";

import { OAuth2Client } from "google-auth-library";

/**
 * Entrar con Google.
 *
 * El navegador recibe de Google un token firmado y nos lo pasa. Aquí se
 * comprueba esa firma contra las claves públicas de Google: un token no
 * verificado es sólo un texto que dice ser de alguien.
 *
 * Se usa el flujo de token de identidad, no el de código de autorización, así
 * que no hace falta guardar ningún secreto de cliente: sólo el identificador,
 * que es público de por sí.
 */

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function googleEnabled() {
  return Boolean(clientId);
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
};

let client: OAuth2Client | null = null;

export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!clientId) throw new Error("Entrar con Google no está configurado.");
  if (!credential || typeof credential !== "string") throw new Error("Falta el token de Google.");

  client ??= new OAuth2Client(clientId);

  // Comprueba la firma, que no haya caducado, que el emisor sea Google y que
  // el token fuera emitido para esta aplicación y no para otra.
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) throw new Error("Google no devolvió un correo.");

  // Sin correo verificado no se vincula nada: si no, alguien podría registrar
  // en Google un correo ajeno y quedarse con la cuenta de esa persona.
  if (!payload.email_verified) throw new Error("Ese correo de Google no está verificado.");

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name?.trim() || payload.email.split("@")[0],
  };
}

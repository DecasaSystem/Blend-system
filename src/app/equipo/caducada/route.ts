import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { clearStaleSession } from "@/lib/session";

/**
 * Paso intermedio cuando la sesión del equipo ya no vale.
 *
 * Las páginas no pueden borrar cookies; esta ruta sí. Borra la cookie vieja
 * y manda a entrar: sin ella el proxy veía la cookie y devolvía a /equipo,
 * que volvía al login, en bucle.
 */
export async function GET(request: NextRequest) {
  await clearStaleSession();
  const url = new URL("/equipo/login", request.url);
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/equipo", "");
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

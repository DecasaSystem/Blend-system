import { NextResponse, type NextRequest } from "next/server";
import { clearStaleCustomerSession } from "@/lib/customer-session";
import { safeNext } from "@/lib/safe-next";

/**
 * Paso intermedio cuando la sesión del cliente ya no vale: borra la cookie
 * vieja, que las páginas no pueden tocar, y manda a entrar. Igual que
 * /equipo/caducada.
 */
export async function GET(request: NextRequest) {
  await clearStaleCustomerSession();
  const url = new URL("/cuenta/entrar", request.url);
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/", "");
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

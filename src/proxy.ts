import { NextResponse, type NextRequest } from "next/server";

/**
 * Guardia de rutas. Corre antes que cualquier página.
 *
 * Primera capa, rápida y sin base de datos: mira si existe la cookie de
 * sesión que toca y, si no, manda a la entrada con un 307 de verdad —antes
 * de renderizar nada— guardando a dónde iba la persona para devolverla ahí
 * al entrar. La segunda capa sigue siendo cada página y cada acción del
 * servidor, que comprueban la sesión contra la base y el rol: una cookie
 * inventada pasa por aquí y se estrella ahí.
 *
 * Aquí no van los roles (barra, admin, repartidor): eso exige leer la base y
 * ya lo hacen las páginas (`/equipo` manda al repartidor a su pantalla, etc.).
 *
 * Los nombres de las cookies son los de `src/lib/session.ts` y
 * `src/lib/customer-session.ts`.
 */

const TEAM_COOKIE = "blend_session";
const CUSTOMER_COOKIE = "blend_customer";

/** Sólo destinos internos del propio sitio: nunca una URL ajena. */
function safeNext(path: string | null, prefix: string) {
  if (!path || !path.startsWith(prefix) || path.startsWith("//")) return null;
  return path;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasTeam = request.cookies.has(TEAM_COOKIE);
  const hasCustomer = request.cookies.has(CUSTOMER_COOKIE);

  // --- Vista de equipo -------------------------------------------------
  if (pathname === "/equipo/login") {
    if (hasTeam) {
      const next = safeNext(request.nextUrl.searchParams.get("next"), "/equipo");
      return NextResponse.redirect(new URL(next ?? "/equipo", request.url));
    }
    return NextResponse.next();
  }
  if (pathname === "/equipo" || pathname.startsWith("/equipo/")) {
    if (!hasTeam) {
      const url = new URL("/equipo/login", request.url);
      // Sólo si iba a algún sitio concreto; a /equipo se vuelve solo.
      if (pathname !== "/equipo") url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Cuenta del cliente ----------------------------------------------
  if (pathname === "/cuenta/entrar" || pathname === "/cuenta/registro") {
    if (hasCustomer) {
      const next = safeNext(request.nextUrl.searchParams.get("next"), "/");
      return NextResponse.redirect(new URL(next ?? "/cuenta", request.url));
    }
    return NextResponse.next();
  }
  if (pathname === "/cuenta" || pathname.startsWith("/cuenta/")) {
    if (!hasCustomer) {
      const url = new URL("/cuenta/entrar", request.url);
      if (pathname !== "/cuenta") url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Sólo las zonas con sesión. La tienda, el quiosco (tiene su propia
  // clave), el checkout y los archivos estáticos no pasan por aquí.
  matcher: ["/equipo", "/equipo/:path*", "/cuenta", "/cuenta/:path*"],
};

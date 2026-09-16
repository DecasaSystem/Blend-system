/**
 * A dónde volver después de entrar.
 *
 * El guardia de rutas (`src/proxy.ts`) manda a la entrada con `?next=` la
 * ruta a la que iba la persona. Sólo se acepta una ruta interna con el
 * prefijo esperado: un `next=https://otro-sitio` o un `//evil` se ignora.
 * Sin eso, un enlace malicioso podría usar la entrada de la tienda para
 * mandar a alguien a otra parte con pinta de legítimo.
 */
export function safeNext(value: unknown, prefix: string, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (!value.startsWith(prefix)) return fallback;
  return value;
}

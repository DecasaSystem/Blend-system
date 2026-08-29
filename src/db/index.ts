import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexión a Postgres.
 *
 * `server-only` es la red de seguridad: si algún día alguien importa esto desde
 * un componente de cliente, la compilación falla en vez de mandar la cadena de
 * conexión al navegador.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("Falta DATABASE_URL. Revisa .env.local (hay plantilla en .env.example).");
}

// En desarrollo Next recarga los módulos en cada cambio; sin esto se abriría
// una conexión nueva cada vez hasta agotar el límite del servidor.
const globalForDb = globalThis as unknown as { blendSql?: ReturnType<typeof postgres> };

const client =
  globalForDb.blendSql ??
  postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") globalForDb.blendSql = client;

export const db = drizzle(client, { schema });
export { schema };

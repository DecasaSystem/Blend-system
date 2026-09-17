/**
 * Pone la base de datos al día con el esquema antes de construir.
 *
 * Corre en `prebuild`, así en Vercel cada despliegue crea las tablas y
 * columnas nuevas antes de que el código que las usa salga a producción.
 * Sin `DATABASE_URL` (una construcción local sin base) no hace nada.
 *
 * Es `drizzle-kit push --force`: sin preguntas, porque en el build no hay
 * nadie para responderlas. Eso significa que un cambio destructivo del
 * esquema (quitar o renombrar una columna) se aplica tal cual. Los cambios
 * hasta ahora son añadir; si algún día hay que quitar algo, mejor hacerlo a
 * mano con `npm run db:push` mirando lo que propone.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("db-sync: sin DATABASE_URL, no se toca la base.");
  process.exit(0);
}

const res = spawnSync(
  process.execPath,
  ["node_modules/drizzle-kit/bin.cjs", "push", "--force"],
  { stdio: "inherit" },
);
if (res.status !== 0) {
  console.error("db-sync: drizzle-kit push falló; se detiene el build.");
  process.exit(res.status ?? 1);
}
console.log("db-sync: esquema al día.");

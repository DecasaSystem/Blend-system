/**
 * Comprueba que la base de datos responde.
 *   node --env-file=.env.local scripts/db-check.mjs
 *
 * No imprime la cadena de conexión ni ningún dato sensible.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 15 });

try {
  const [info] = await sql`
    select version() as version,
           current_database() as db,
           current_user as usuario
  `;
  const [{ count }] = await sql`
    select count(*)::int as count
    from information_schema.tables
    where table_schema = 'public'
  `;

  console.log("Conexión correcta");
  console.log("  motor:  " + info.version.split(",")[0]);
  console.log("  base:   " + info.db);
  console.log("  usuario:" + info.usuario);
  console.log("  tablas en public: " + count);
} catch (err) {
  console.error("No conecta:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

/**
 * Lista las cuentas del equipo. No muestra contraseñas: sólo se guarda su
 * hash, y de un hash no se recupera la contraseña.
 *
 *   node --env-file=.env.local scripts/list-users.mjs
 */
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. ¿Corriste con --env-file=.env.local?");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const rows = await sql`
    select email, name, role, created_at, last_login_at
    from users
    order by created_at
  `;

  if (rows.length === 0) {
    console.log("No hay ninguna cuenta de equipo todavía.");
    console.log("Créala con:");
    console.log('  node --env-file=.env.local scripts/create-user.mjs correo "Nombre" admin');
  } else {
    console.log(`${rows.length} cuenta(s) de equipo:\n`);
    for (const r of rows) {
      const last = r.last_login_at
        ? new Date(r.last_login_at).toLocaleString("es-CO")
        : "nunca ha entrado";
      console.log(`  ${r.email}`);
      console.log(`    ${r.name} · ${r.role} · último acceso: ${last}\n`);
    }
  }
} catch (err) {
  console.error("No se pudo consultar:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

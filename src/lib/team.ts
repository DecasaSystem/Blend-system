/**
 * Acceso a la vista de equipo.
 *
 * OJO: esto es un pestillo, no una cerradura. La clave viaja en el bundle del
 * navegador y solo evita que alguien entre por curiosidad desde el pie de página.
 * En la fase 7 se reemplaza por autenticación real en el servidor, y hasta
 * entonces la vista de equipo no debe mostrar nada que no pueda ser público.
 */
export const TEAM_PASSWORD = "blend2026";
export const TEAM_SESSION_KEY = "blend.team.session";

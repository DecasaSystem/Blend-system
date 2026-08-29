/**
 * Copia el worker de MapLibre a /public.
 *
 * MapLibre deduce la URL de su worker de `import.meta.url`. Al pasar por el
 * bundler eso resuelve a la propia página, así que el worker arranca con HTML
 * dentro, se queda mudo y el mapa nunca carga — sin dar ningún error.
 *
 * Tampoco sirve dejar que el bundler emita el worker: importa un módulo hermano
 * con ruta relativa, y ese no se emite. Por eso van los dos juntos, con sus
 * nombres originales, y se sirven tal cual desde /public.
 *
 * Corre solo antes de `dev` y de `build`.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(from)) {
  console.log("maplibre-gl no está instalado; nada que copiar.");
  process.exit(0);
}

await mkdir(to, { recursive: true });
for (const file of FILES) {
  await copyFile(join(from, file), join(to, file));
}
console.log(`maplibre: ${FILES.length} archivos copiados a public/maplibre`);

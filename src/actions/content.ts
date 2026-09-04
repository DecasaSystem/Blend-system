"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent, SITE_ROW_ID } from "@/db/schema";
import { defaultSite, normalizeSite, type SiteContent } from "@/lib/site";
import { requireUser } from "@/lib/session";

/**
 * Contenido del sitio. Una fila con el objeto entero: la misma forma que tenía
 * en el navegador, así que el editor no cambia.
 */

/**
 * Los cold starts de Vercel a veces fallan la primera conexión a Aiven. Un
 * solo reintento tras una pausa corta recupera la mayoría de esos casos sin
 * que el usuario note nada.
 */
async function tryLoadRow() {
  const [row] = await db
    .select()
    .from(siteContent)
    .where(eq(siteContent.id, SITE_ROW_ID))
    .limit(1);
  return row ?? null;
}

export async function loadSiteContent(): Promise<SiteContent> {
  const base = defaultSite();
  try {
    let row = await tryLoadRow();
    if (!row) {
      await new Promise((r) => setTimeout(r, 2000));
      row = await tryLoadRow();
    }
    // Mezcla superficial + normalización: si el código añade una sección o un
    // campo nuevo (como `productIds`), aparece aunque el equipo tenga contenido
    // guardado de antes.
    return row ? normalizeSite({ ...base, ...row.data }) : base;
  } catch (e) {
    // Si la base no responde, la tienda sigue en pie con los valores de
    // fábrica. El error queda en los Function Logs de Vercel para diagnosticar;
    // antes se tragaba en silencio y parecía que "no se había guardado nada".
    console.error("[loadSiteContent] No se pudo leer site_content:", e);
    return base;
  }
}

export async function saveSiteContent(data: SiteContent) {
  const user = await requireUser();
  console.log("[saveSiteContent] Guardando contenido, editado por:", user.email);

  const written = await db
    .insert(siteContent)
    .values({ id: SITE_ROW_ID, data, updatedBy: user.email })
    .onConflictDoUpdate({
      target: siteContent.id,
      set: { data, updatedAt: new Date(), updatedBy: user.email },
    })
    .returning({ id: siteContent.id, updatedAt: siteContent.updatedAt });

  if (written.length === 0) {
    console.error("[saveSiteContent] El upsert no devolvió fila: no se guardó nada.");
    throw new Error("No se pudo guardar el contenido. Intenta de nuevo.");
  }
  console.log("[saveSiteContent] Guardado OK:", written[0].id, written[0].updatedAt);

  // La tienda se sirve desde el servidor: hay que rehacerla para que se vea.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetSiteContent() {
  await requireUser();
  await db.delete(siteContent).where(eq(siteContent.id, SITE_ROW_ID));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function siteContentMeta() {
  await requireUser();
  const [row] = await db
    .select({ updatedAt: siteContent.updatedAt, updatedBy: siteContent.updatedBy })
    .from(siteContent)
    .where(eq(siteContent.id, SITE_ROW_ID))
    .limit(1);
  return row ?? null;
}

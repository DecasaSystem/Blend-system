"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent, SITE_ROW_ID } from "@/db/schema";
import { defaultSite, type SiteContent } from "@/lib/site";
import { requireUser } from "@/lib/session";

/**
 * Contenido del sitio. Una fila con el objeto entero: la misma forma que tenía
 * en el navegador, así que el editor no cambia.
 */

export async function loadSiteContent(): Promise<SiteContent> {
  const base = defaultSite();
  try {
    const [row] = await db
      .select()
      .from(siteContent)
      .where(eq(siteContent.id, SITE_ROW_ID))
      .limit(1);
    // Mezcla superficial: si el código añade una sección nueva, aparece aunque
    // el equipo tenga contenido guardado de antes.
    return row ? { ...base, ...row.data } : base;
  } catch {
    // Si la base no responde, la tienda sigue en pie con los valores de fábrica.
    return base;
  }
}

export async function saveSiteContent(data: SiteContent) {
  const user = await requireUser();

  await db
    .insert(siteContent)
    .values({ id: SITE_ROW_ID, data, updatedBy: user.email })
    .onConflictDoUpdate({
      target: siteContent.id,
      set: { data, updatedAt: new Date(), updatedBy: user.email },
    });

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

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { amountMatches, readApprovedPayment } from "@/lib/payments";

/**
 * Aviso de Wompi cuando cambia el estado de una transacción.
 *
 * Es lo único que mueve un pedido de `pago` a `nuevo`, es decir, lo que hace
 * que aparezca en el tablero. Nada de lo que llega en el cuerpo se toma por
 * bueno: la firma se comprueba y además se le vuelve a preguntar a Wompi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // El cuerpo se lee en crudo: el checksum se calcula sobre lo que llegó.
  const raw = await request.text();

  let payment;
  try {
    payment = await readApprovedPayment(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[wompi] aviso rechazado:", message);

    // Si el problema fue no poder confirmar con Wompi, se pide reintento; si
    // la firma estaba mal, se rechaza y punto.
    const cannotConfirm = message.includes("no confirmó");
    return NextResponse.json(
      { error: cannotConfirm ? "no se pudo confirmar" : "firma inválida" },
      { status: cannotConfirm ? 503 : 400 },
    );
  }

  // Un evento que no interesa —o un pago no aprobado— igual responde 200:
  // si no, Wompi lo reintenta para siempre.
  if (!payment) return NextResponse.json({ ok: true });

  const [order] = await db
    .select({ id: orders.id, total: orders.total, status: orders.status })
    .from(orders)
    .where(eq(orders.id, payment.reference))
    .limit(1);

  if (!order) {
    console.warn("[wompi] referencia sin pedido:", payment.reference);
    return NextResponse.json({ ok: true });
  }

  // Lo cobrado tiene que ser lo que costaba. Si no cuadra, no se libera nada
  // y queda anotado para revisarlo a mano.
  if (!amountMatches(order.total, payment.amountInCents)) {
    console.error(
      `[wompi] monto que no cuadra en ${order.id}: cobrado ${payment.amountInCents}, esperado ${order.total * 100}`,
    );
    return NextResponse.json({ ok: true });
  }

  // Sólo se mueve si sigue esperando pago: así un reenvío de Wompi no devuelve
  // atrás un pedido que la barra ya empezó a preparar.
  if (order.status !== "pago") return NextResponse.json({ ok: true });

  await db
    .update(orders)
    .set({ status: "nuevo", statusAt: new Date(), paidAt: new Date(), payment: "tarjeta" })
    .where(eq(orders.id, order.id));

  return NextResponse.json({ ok: true });
}

/** Para comprobar de un vistazo que la ruta existe. */
export async function GET() {
  return NextResponse.json({ ok: true, ruta: "wompi/webhook" });
}

import { NextResponse } from "next/server";
import { readPaymentEvent } from "@/lib/payments";
import { settlePayment } from "@/lib/settle-payment";

/**
 * Aviso de Bold cuando una venta se aprueba o se rechaza.
 *
 * Es lo que mueve un pedido de `pago` a `nuevo` —a la barra— o a `fallido`
 * si el banco lo rechazó. La página de vuelta hace lo mismo cuando el cliente
 * regresa, así que normalmente el aviso llega a un pedido ya resuelto y no
 * cambia nada; sigue haciendo falta para quien cierra la pestaña en Bold y
 * para los pagos que el banco confirma minutos después (PSE).
 *
 * Bold espera un 200 en menos de dos segundos; si no, reintenta a los 15 min,
 * 1 h, 4 h, 8 h y 24 h. Aquí sólo hay una comprobación de firma y dos consultas
 * a la base, así que se responde de sobra.
 *
 * Nada de lo que llega en el cuerpo se toma por bueno sin la firma: es un
 * HMAC con la llave secreta sobre el cuerpo entero.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // El cuerpo se lee en crudo: la firma se calcula sobre lo que llegó.
  const raw = await request.text();

  let payment;
  try {
    payment = readPaymentEvent(raw, request.headers.get("x-bold-signature"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[bold] aviso rechazado:", message);
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  // Un evento que no interesa (una anulación, por ejemplo) igual responde 200:
  // si no, Bold lo reintenta durante un día. Lo mismo con un monto que no
  // cuadra: queda en el log, no en una cola de reintentos.
  if (!payment) return NextResponse.json({ ok: true });

  try {
    await settlePayment(payment);
  } catch (err) {
    // La base no respondió: se pide reintento. Marcar el pedido como pagado
    // sin poder guardarlo sería peor que esperar quince minutos.
    console.error("[bold] no se pudo aplicar el aviso:", err);
    return NextResponse.json({ error: "no se pudo guardar" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

/** Para comprobar de un vistazo que la ruta existe. */
export async function GET() {
  return NextResponse.json({ ok: true, ruta: "bold/webhook" });
}

import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Cobros con tarjeta — Wompi (Colombia).
 *
 * Todo lo que sabe la app sobre la pasarela está en este archivo. El checkout
 * llama a `startPayment` y el webhook a `readApprovedReference`; nada más
 * necesita saber qué proveedor hay detrás.
 *
 * Wompi no lleva SDK: el cobro es una redirección con firma y la confirmación
 * llega por webhook. Por eso aquí sólo hay URLs y hashes.
 *
 * Documentación:
 *   https://docs.wompi.co/docs/colombia/widget-checkout-web/
 *   https://docs.wompi.co/docs/colombia/eventos/
 */

const publicKey = process.env.WOMPI_PUBLIC_KEY;
const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
const eventsSecret = process.env.WOMPI_EVENTS_SECRET;

/** Wompi cobra en pesos colombianos, contados en centavos. */
const MINOR_UNITS = 100;
const CURRENCY = "COP";

const CHECKOUT_URL = process.env.WOMPI_CHECKOUT_URL ?? "https://checkout.wompi.co/p/";

/** Sin claves, la tienda sigue funcionando: sólo se cobra al recibir. */
export function paymentsEnabled() {
  return Boolean(publicKey && integritySecret);
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export type PaymentInput = {
  /** El número de pedido. Viaja como `reference` y es lo que devuelve el webhook. */
  orderId: string;
  total: number;
  email?: string;
  name?: string;
  phone?: string;
  redirectUrl: string;
};

/** Arma la URL de pago firmada. */
export function startPayment(input: PaymentInput): { url: string } {
  if (!publicKey || !integritySecret) {
    throw new Error("Los pagos con tarjeta no están configurados.");
  }

  const amountInCents = Math.round(input.total * MINOR_UNITS);

  // La firma de integridad va sobre referencia + monto + moneda + secreto, en
  // ese orden exacto. Es lo que impide que alguien cambie el monto en la URL.
  const signature = sha256(`${input.orderId}${amountInCents}${CURRENCY}${integritySecret}`);

  const params = new URLSearchParams({
    "public-key": publicKey,
    currency: CURRENCY,
    "amount-in-cents": String(amountInCents),
    reference: input.orderId,
    "signature:integrity": signature,
    "redirect-url": input.redirectUrl,
  });

  if (input.email) params.set("customer-data:email", input.email);
  if (input.name) params.set("customer-data:full-name", input.name);
  if (input.phone) params.set("customer-data:phone-number", input.phone.replace(/\D/g, ""));

  return { url: `${CHECKOUT_URL}?${params.toString()}` };
}

type WompiEvent = {
  event?: string;
  timestamp?: number;
  data?: { transaction?: Record<string, unknown> };
  signature?: { properties?: string[]; checksum?: string };
};

export type ApprovedPayment = { reference: string; amountInCents: number; transactionId: string };

/**
 * La API de Wompi. El prefijo de la clave dice en qué ambiente estamos.
 * `WOMPI_API_BASE` sólo se usa en pruebas, para apuntar a un servidor de mentira.
 */
function apiBase() {
  if (process.env.WOMPI_API_BASE) return process.env.WOMPI_API_BASE.replace(/\/$/, "");
  return publicKey?.startsWith("pub_prod_")
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

/**
 * Comprueba el aviso y devuelve el pago si de verdad fue aprobado.
 *
 * Son dos pasos, y el segundo importa tanto como el primero:
 *
 * 1. Se recalcula el checksum con los campos que el propio aviso lista en
 *    `signature.properties`, más el timestamp y el secreto de eventos. Eso
 *    descarta un aviso inventado desde fuera.
 *
 * 2. Se vuelve a preguntar a Wompi por la transacción usando su `id`. Hace
 *    falta porque la firma SÓLO cubre los campos listados, y `reference` no
 *    suele estar entre ellos: con la firma a secas, alguien podría tomar el
 *    aviso legítimo de su propio pago, cambiarle la referencia por la de otro
 *    pedido —el checksum seguiría cuadrando— y hacer que ese pedido saliera a
 *    la barra sin pagarse. La referencia y el monto se leen de la respuesta de
 *    Wompi, nunca del cuerpo recibido.
 */
export async function readApprovedPayment(rawBody: string): Promise<ApprovedPayment | null> {
  if (!eventsSecret) throw new Error("Falta WOMPI_EVENTS_SECRET.");
  if (!publicKey) throw new Error("Falta WOMPI_PUBLIC_KEY.");

  let event: WompiEvent;
  try {
    event = JSON.parse(rawBody) as WompiEvent;
  } catch {
    throw new Error("Cuerpo del aviso ilegible.");
  }

  const properties = event.signature?.properties;
  const received = event.signature?.checksum;
  if (!Array.isArray(properties) || !received || typeof event.timestamp !== "number") {
    throw new Error("Aviso sin firma.");
  }

  const concatenated =
    properties.map((path) => String(readPath(event, path) ?? "")).join("") +
    event.timestamp +
    eventsSecret;

  if (!sameHash(sha256(concatenated), received)) throw new Error("Firma que no cuadra.");

  if (event.event !== "transaction.updated") return null;

  const transactionId = event.data?.transaction?.id;
  if (typeof transactionId !== "string" || !transactionId) return null;

  // El id tiene que estar entre los campos firmados; si no, tampoco es de fiar.
  if (!properties.includes("transaction.id")) {
    throw new Error("El aviso no firma el id de la transacción.");
  }

  return confirmWithWompi(transactionId);
}

/** La fuente de verdad: lo que diga Wompi cuando se le pregunta directamente. */
async function confirmWithWompi(transactionId: string): Promise<ApprovedPayment | null> {
  const res = await fetch(`${apiBase()}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${publicKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    // Se lanza a propósito: la ruta responderá con error y Wompi reintentará.
    // Marcar un pedido como pagado sin poder confirmarlo sería peor.
    throw new Error(`Wompi no confirmó la transacción (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as {
    data?: { status?: string; reference?: string; amount_in_cents?: number };
  };
  const data = body.data;

  if (!data || data.status !== "APPROVED") return null;
  if (typeof data.reference !== "string" || typeof data.amount_in_cents !== "number") return null;

  return {
    reference: data.reference,
    amountInCents: data.amount_in_cents,
    transactionId,
  };
}

/** Lo que se cobró tiene que ser lo que costaba el pedido. */
export function amountMatches(totalInPesos: number, amountInCents: number) {
  return Math.round(totalInPesos * MINOR_UNITS) === amountInCents;
}

/** Los `properties` vienen como "transaction.status", relativos a `data`. */
function readPath(event: WompiEvent, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      event.data,
    );
}

/** Comparación de tiempo constante: comparar con === filtra información. */
function sameHash(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b.toLowerCase(), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

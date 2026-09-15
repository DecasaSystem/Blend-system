import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cobros en línea — Bold (Colombia): tarjeta, PSE, Nequi y Botón Bancolombia,
 * todos por la misma página de pago de Bold.
 *
 * Todo lo que sabe la app sobre la pasarela está en este archivo. El checkout
 * llama a `startPayment`; el webhook y la página de vuelta llaman a
 * `readPaymentEvent` / `lookupPayment` y le pasan el resultado a
 * `settlePayment` (en `settle-payment.ts`). Nada más necesita saber qué
 * proveedor hay detrás.
 *
 * Se usa la **API de links de pago**, no el botón con script: el servidor
 * crea un link cerrado por el total del pedido y manda al cliente a la página
 * de Bold. Así no se carga ningún script de terceros en la tienda, y el
 * estado del link se puede consultar al instante cuando el cliente vuelve
 * (la consulta del botón, `payment-voucher`, puede tardar hasta diez minutos
 * en tener la venta).
 *
 * Bold cuenta en pesos enteros, sin centavos. La firma de los webhooks es un
 * HMAC sobre el cuerpo completo, así que ahí sí se puede confiar en lo que
 * dice el aviso: no hace falta volver a preguntar.
 *
 * Documentación:
 *   https://developers.bold.co/pagos-en-linea/api-link-de-pagos
 *   https://developers.bold.co/webhook
 *   https://developers.bold.co/pagos-en-linea/llaves-de-integracion
 */

/** "Llave de identidad": identifica al comercio. Es pública, pero aquí sólo la usa el servidor. */
const apiKey = process.env.BOLD_API_KEY;
/** "Llave secreta": firma los webhooks. Sólo en el servidor. */
const secretKey = process.env.BOLD_SECRET_KEY;

const CURRENCY = "COP";

/** La API de integraciones. `BOLD_API_BASE` sólo se usa en pruebas, contra un stub. */
const API_BASE = (process.env.BOLD_API_BASE ?? "https://integrations.api.bold.co").replace(
  /\/$/,
  "",
);

/**
 * Cuánto vale el enlace de pago. Pasado ese tiempo Bold lo da por vencido, y
 * el pedido también (`expireStalePayments`). Un batido no se pide con horas de
 * antelación: media hora sobra para escribir una tarjeta.
 */
export const PAYMENT_WINDOW_MINUTES = 30;

/** Sin la llave, la tienda sigue funcionando: sólo se cobra al recibir. */
export function paymentsEnabled() {
  return Boolean(apiKey);
}

export type PaymentInput = {
  /** El número de pedido. Viaja como `reference` del link. */
  orderId: string;
  /** En pesos. */
  total: number;
  email?: string;
  description: string;
  redirectUrl: string;
};

/**
 * Crea el link de pago y devuelve a dónde mandar al cliente.
 *
 * `ref` es el id del link (`LNK_…`). Hay que guardarlo en el pedido: es lo que
 * Bold manda como referencia en el webhook y con lo que se consulta el estado.
 */
export async function startPayment(input: PaymentInput): Promise<{ url: string; ref: string }> {
  if (!apiKey) throw new Error("Los pagos en línea no están configurados.");

  // Bold quiere la caducidad en nanosegundos desde la época Unix.
  const expiresAt = (Date.now() + PAYMENT_WINDOW_MINUTES * 60_000) * 1e6;

  // Bold pide entre 2 y 100 caracteres.
  const description = input.description.trim().slice(0, 100);

  // Bold sólo acepta volver a una URL https; con http responde 403 a secas.
  // En local (http://localhost) se manda el link sin vuelta: el cliente ve el
  // recibo de Bold con el número de pedido y regresa a mano. En producción
  // siempre es https.
  const secureReturn = input.redirectUrl.startsWith("https://");
  if (!secureReturn) {
    console.warn(`[bold] la URL de vuelta no es https, se omite: ${input.redirectUrl}`);
  }

  const res = await fetch(`${API_BASE}/online/link/v1`, {
    method: "POST",
    headers: { Authorization: `x-api-key ${apiKey}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      amount_type: "CLOSE",
      amount: { currency: CURRENCY, total_amount: Math.round(input.total), tip_amount: 0 },
      // Bold no admite repetir la referencia: el número de pedido es único.
      reference: input.orderId,
      description: description.length >= 2 ? description : "Pedido BLEND",
      expiration_date: expiresAt,
      ...(secureReturn ? { callback_url: input.redirectUrl } : {}),
      ...(input.email ? { payer_email: input.email } : {}),
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | { payload?: { payment_link?: string; url?: string }; errors?: unknown[] }
    | null;

  const ref = body?.payload?.payment_link;
  const url = body?.payload?.url;
  if (!res.ok || !ref || !url) {
    console.error(
      "[bold] no se pudo crear el link:",
      res.status,
      JSON.stringify(body?.errors ?? body),
    );
    throw new Error(`Bold no creó el link de pago (HTTP ${res.status}).`);
  }

  return { url, ref };
}

/** Lo que la app necesita saber de un cobro, venga del webhook o de una consulta. */
export type PaymentStatus =
  /** Cobrado. */
  | "approved"
  /** El banco todavía lo procesa (PSE). */
  | "pending"
  /** El link sigue abierto: el cliente no ha pagado todavía. */
  | "open"
  /** Rechazado, cancelado, con error o vencido. Nadie pagó. */
  | "failed";

export type PaymentLookup = {
  status: PaymentStatus;
  /** Con lo que se encuentra el pedido: el id del link, o nuestro número de pedido. */
  reference: string;
  /** En pesos. */
  amount: number;
  transactionId?: string;
};

/** Los estados de un link de pago según Bold. */
const LINK_STATUS: Record<string, PaymentStatus> = {
  PAID: "approved",
  ACTIVE: "open",
  PROCESSING: "pending",
  REJECTED: "failed",
  CANCELLED: "failed",
  EXPIRED: "failed",
};

/**
 * La fuente de verdad: lo que diga Bold del link cuando se le pregunta.
 *
 * Lo usa la página de vuelta: con el `payment_ref` guardado en el pedido se
 * confirma al instante, sin esperar al webhook (que además, en modo pruebas,
 * Bold no manda solo).
 *
 * Lanza si Bold no responde: quien llama decide si reintentar o esperar.
 * Dar por bueno un pago sin poder confirmarlo sería peor.
 */
export async function lookupPayment(ref: string): Promise<PaymentLookup> {
  if (!apiKey) throw new Error("Falta BOLD_API_KEY.");

  const res = await fetch(`${API_BASE}/online/link/v1/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `x-api-key ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Bold no confirmó el link de pago (HTTP ${res.status}).`);

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    total?: number;
    transaction_id?: string;
  };

  const status = data.status ? LINK_STATUS[data.status] : undefined;
  if (!status || typeof data.total !== "number") {
    throw new Error("Bold respondió con un link que no se entiende.");
  }

  return { status, reference: ref, amount: data.total, transactionId: data.transaction_id };
}

type BoldEvent = {
  id?: string;
  type?: string;
  data?: {
    payment_id?: string;
    amount?: { currency?: string; total?: number };
    metadata?: { reference?: string };
  };
};

/** Los tipos de aviso que manda Bold y qué significan para el pedido. */
const EVENT_STATUS: Record<string, PaymentStatus | null> = {
  SALE_APPROVED: "approved",
  SALE_REJECTED: "failed",
  // Una anulación es un reembolso: lo resuelve el equipo a mano, no el tablero.
  VOID_APPROVED: null,
  VOID_REJECTED: null,
};

/**
 * Comprueba el aviso y devuelve lo que dice del cobro.
 *
 * La firma viaja en la cabecera `x-bold-signature`: HMAC-SHA256 con la llave
 * secreta sobre el cuerpo en base64, en hexadecimal. Como cubre el cuerpo
 * entero, con la firma bien todo lo que dice el aviso es de fiar —la
 * referencia y el monto incluidos—, así que no hay que volver a preguntar.
 *
 * Devuelve null si el aviso es legítimo pero no cambia nada del pedido.
 */
export function readPaymentEvent(
  rawBody: string,
  signature: string | null,
): PaymentLookup | null {
  // En modo pruebas Bold firma con la llave vacía; en producción, nunca.
  if (secretKey === undefined) throw new Error("Falta BOLD_SECRET_KEY.");
  if (!signature) throw new Error("Aviso sin firma.");

  const expected = createHmac("sha256", secretKey)
    .update(Buffer.from(rawBody, "utf8").toString("base64"))
    .digest("hex");

  if (!sameHash(expected, signature)) throw new Error("Firma que no cuadra.");

  let event: BoldEvent;
  try {
    event = JSON.parse(rawBody) as BoldEvent;
  } catch {
    throw new Error("Cuerpo del aviso ilegible.");
  }

  const status = event.type ? EVENT_STATUS[event.type] : undefined;
  if (!status) return null;

  const reference = event.data?.metadata?.reference;
  const amount = event.data?.amount?.total;
  if (typeof reference !== "string" || !reference || typeof amount !== "number") {
    throw new Error("El aviso no trae referencia o monto.");
  }

  return { status, reference, amount, transactionId: event.data?.payment_id };
}

/** Lo que se cobró tiene que ser lo que costaba el pedido. Los dos en pesos. */
export function amountMatches(totalInPesos: number, amountInPesos: number) {
  return Math.round(totalInPesos) === Math.round(amountInPesos);
}

/** Comparación de tiempo constante: comparar con === filtra información. */
function sameHash(a: string, b: string) {
  const left = Buffer.from(a.toLowerCase(), "utf8");
  const right = Buffer.from(b.trim().toLowerCase(), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Prueba del webhook de Wompi, que es lo único que mueve un pedido de
 * "esperando pago" a la barra.
 *
 * Levanta un servidor que hace de API de Wompi, así que no hacen falta claves
 * reales ni red. El servidor de desarrollo tiene que arrancarse apuntando a él:
 *
 *   $env:WOMPI_PUBLIC_KEY='pub_test_ficticia'
 *   $env:WOMPI_INTEGRITY_SECRET='test_integrity_ficticio'
 *   $env:WOMPI_EVENTS_SECRET='test_events_ficticio'
 *   $env:WOMPI_API_BASE='http://localhost:4010/v1'
 *   npm run dev
 *
 *   node --env-file=.env.local scripts/webhook-flow.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { reporter, sqlClient } from "./lib/team.mjs";

const URL = process.argv[2] ?? "http://localhost:3000";
const SECRET = process.argv[3] ?? "test_events_ficticio";
const STUB_PORT = 4010;

const sql = sqlClient();
const { check, crashed, finish } = reporter();

const orderId = `B-TEST-${randomUUID().slice(0, 6)}`;
const TOTAL = 10000;
const sha256 = (v) => createHash("sha256").update(v, "utf8").digest("hex");

const PROPERTIES = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];

/** Lo que responderá la API de mentira para cada transacción consultada. */
const ledger = new Map();

const stub = createServer((req, res) => {
  const id = decodeURIComponent(req.url.split("/").pop());
  const record = ledger.get(id);
  res.setHeader("content-type", "application/json");
  if (!record) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "no existe" }));
    return;
  }
  res.end(JSON.stringify({ data: record }));
});

await new Promise((resolve) => stub.listen(STUB_PORT, resolve));

/** Arma un aviso como los que manda Wompi, con su checksum. */
function buildEvent({
  transactionId = "12345-1610641025-49201",
  reference = orderId,
  status = "APPROVED",
  secret = SECRET,
  amount = TOTAL * 100,
  timestamp = Math.floor(Date.now() / 1000),
  event = "transaction.updated",
  properties = PROPERTIES,
} = {}) {
  const transaction = {
    id: transactionId,
    status,
    amount_in_cents: amount,
    reference,
    currency: "COP",
  };
  const values = properties
    .map((p) => String(p.split(".").reduce((n, k) => n?.[k], { transaction }) ?? ""))
    .join("");

  return JSON.stringify({
    event,
    data: { transaction },
    environment: "test",
    signature: { properties, checksum: sha256(values + timestamp + secret) },
    timestamp,
    sent_at: new Date().toISOString(),
  });
}

async function post(body) {
  const res = await fetch(`${URL}/api/wompi/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return res.status;
}

async function seed(status = "pago") {
  await sql`
    insert into orders (id, status, mode, store_id, customer, lines, subtotal, delivery, total, payment)
    values (${orderId}, ${status}, 'recoger', 'norte',
            ${sql.json({ name: "Prueba", phone: "300" })},
            ${sql.json([])}, ${TOTAL}, 0, ${TOTAL}, 'tarjeta')
    on conflict (id) do update set status = ${status}, paid_at = null
  `;
}

async function statusOf() {
  const [row] = await sql`select status, paid_at from orders where id = ${orderId}`;
  return row;
}

try {
  // Lo que Wompi "dirá" cuando le pregunten por esta transacción.
  ledger.set("12345-1610641025-49201", {
    id: "12345-1610641025-49201",
    status: "APPROVED",
    reference: orderId,
    amount_in_cents: TOTAL * 100,
  });

  await seed();

  // --- Sin firma ---
  const naked = JSON.stringify({ event: "transaction.updated", data: {} });
  check("sin firma responde 400", (await post(naked)) === 400);
  check("sin firma no toca el pedido", (await statusOf()).status === "pago");

  // --- Firmado con otro secreto ---
  check(
    "con secreto equivocado responde 400",
    (await post(buildEvent({ secret: "otro_secreto" }))) === 400,
  );
  check("con secreto equivocado no toca el pedido", (await statusOf()).status === "pago");

  // --- Campos firmados alterados después de firmar ---
  const good = buildEvent();
  const tampered = good.replace('"amount_in_cents":1000000', '"amount_in_cents":100');
  check("si cambian un campo firmado responde 400", (await post(tampered)) === 400);
  check("si cambian un campo firmado no toca el pedido", (await statusOf()).status === "pago");

  // --- La referencia NO va firmada: por eso se confirma contra Wompi ---
  // Se toma un aviso legítimo y se le cambia sólo la referencia. El checksum
  // sigue cuadrando, así que la única defensa es preguntarle a Wompi.
  await sql`
    insert into orders (id, status, mode, store_id, customer, lines, subtotal, delivery, total, payment)
    values ('B-VICTIMA', 'pago', 'recoger', 'norte',
            ${sql.json({ name: "Otra", phone: "300" })},
            ${sql.json([])}, ${TOTAL}, 0, ${TOTAL}, 'tarjeta')
    on conflict (id) do update set status = 'pago'
  `;
  const hijacked = good.replace(`"reference":"${orderId}"`, '"reference":"B-VICTIMA"');
  check("un aviso con la referencia cambiada responde 200", (await post(hijacked)) === 200);
  const [victim] = await sql`select status from orders where id = 'B-VICTIMA'`;
  check(
    "cambiar la referencia no libera el pedido de otro",
    victim.status === "pago",
    victim.status,
  );

  // --- Si el aviso no firma el id, no es de fiar ---
  const unsignedId = buildEvent({ properties: ["transaction.status"] });
  check("rechaza un aviso que no firma el id", (await post(unsignedId)) === 400);

  // --- Firma correcta ---
  check("con firma válida responde 200", (await post(good)) === 200);
  const paid = await statusOf();
  check("mueve el pedido a la barra", paid.status === "nuevo", paid.status);
  check("anota cuándo se pagó", paid.paid_at !== null);

  // --- Reenvío: Wompi reintenta, no debe deshacer trabajo ---
  await sql`update orders set status = 'preparando' where id = ${orderId}`;
  check("un reenvío responde 200", (await post(buildEvent())) === 200);
  const after = await statusOf();
  check("el reenvío no devuelve el pedido a Nuevo", after.status === "preparando", after.status);

  // --- Wompi dice que no está aprobada ---
  await seed();
  ledger.set("12345-1610641025-49201", {
    id: "12345-1610641025-49201",
    status: "DECLINED",
    reference: orderId,
    amount_in_cents: TOTAL * 100,
  });
  check("un pago rechazado responde 200", (await post(buildEvent({ status: "DECLINED" }))) === 200);
  check("un pago rechazado no libera el pedido", (await statusOf()).status === "pago");

  // --- Monto que no cuadra con el pedido ---
  ledger.set("12345-1610641025-49201", {
    id: "12345-1610641025-49201",
    status: "APPROVED",
    reference: orderId,
    amount_in_cents: 100,
  });
  check("un monto que no cuadra responde 200", (await post(buildEvent({ amount: 100 }))) === 200);
  check("un monto que no cuadra no libera el pedido", (await statusOf()).status === "pago");

  // --- Wompi no responde: hay que reintentar, no dar por bueno ---
  const unknown = buildEvent({ transactionId: "no-existe-en-wompi" });
  check("si Wompi no confirma responde 503", (await post(unknown)) === 503);
  check("si Wompi no confirma no libera el pedido", (await statusOf()).status === "pago");

  // --- Otro tipo de evento ---
  check(
    "otro evento responde 200",
    (await post(buildEvent({ event: "nequi_token.updated" }))) === 200,
  );
  check("otro evento no libera el pedido", (await statusOf()).status === "pago");
} catch (err) {
  crashed(err);
} finally {
  stub.close();
  await sql`delete from orders where id in (${orderId}, 'B-VICTIMA')`;
  const failures = finish();
  await sql.end({ timeout: 5 });
  process.exit(failures ? 1 : 0);
}

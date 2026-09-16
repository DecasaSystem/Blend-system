"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { CupLoader } from "@/components/CupLoader";
import { kioskCancelPayment, kioskPayAtCounter, kioskPaymentStatus } from "@/actions/kiosk";
import type { ReturnState } from "@/lib/settle-payment";
import { money } from "@/lib/cart";

/**
 * Pagar ahora, en una pantalla que no es del cliente.
 *
 * La tablet es de la tienda, así que lo primero que se ofrece es un QR: el
 * cliente lo escanea y paga en su propio celular (Nequi y PSE lo necesitan
 * igual, y nadie quiere escribir su tarjeta en una pantalla compartida). La
 * tablet pregunta cada pocos segundos si ya entró la plata y, cuando entra,
 * enseña el número y vuelve al inicio. También puede pagar aquí mismo, o
 * cambiar de idea y pagar en caja.
 *
 * Si nadie hace nada durante un rato —se fue sin pagar—, la pantalla vuelve
 * al inicio sola. El pedido queda esperando: si lo paga desde el celular más
 * tarde, entra igual a la barra; si no, caduca.
 */

const CADA = 4; // segundos entre consultas
const ABANDONO = 240; // segundos sin pagar antes de volver al inicio

export default function KioskPay({
  orderId,
  url,
  total,
  initialState = "open",
  onPaid,
  onCounter,
  onCancel,
}: {
  orderId: string;
  /** El link de Bold. Falta si la tablet vuelve de Bold sin haber pagado. */
  url?: string;
  total: number;
  initialState?: ReturnState;
  onPaid: () => void;
  onCounter: () => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<ReturnState>(initialState);
  const [restante, setRestante] = useState(ABANDONO);
  const [ocupado, setOcupado] = useState(false);
  const paidRef = useRef(false);

  // Consulta periódica: ¿ya pagó desde el celular?
  useEffect(() => {
    if (state === "confirmed" || state === "failed") return;
    const t = setInterval(async () => {
      try {
        const { state: s } = await kioskPaymentStatus(orderId);
        setState(s);
      } catch {
        /* sin red un momento: se vuelve a intentar */
      }
    }, CADA * 1000);
    return () => clearInterval(t);
  }, [orderId, state]);

  useEffect(() => {
    if (state === "confirmed" && !paidRef.current) {
      paidRef.current = true;
      onPaid();
    }
  }, [state, onPaid]);

  // Abandono: la pantalla no puede quedarse esperando a alguien que se fue.
  useEffect(() => {
    if (state === "confirmed" || state === "failed") return;
    if (restante <= 0) {
      onCancel();
      return;
    }
    const t = setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [restante, state, onCancel]);

  const qr = useMemo(() => {
    if (!url) return null;
    const code = qrcode(0, "M");
    code.addData(url);
    code.make();
    // `scalable`: el SVG llena el hueco que le den, nítido a cualquier tamaño.
    return code.createSvgTag({ scalable: true, margin: 0 });
  }, [url]);

  const aCaja = async () => {
    setOcupado(true);
    const res = await kioskPayAtCounter(orderId);
    setOcupado(false);
    if ("ok" in res) onCounter();
  };

  const cancelar = async () => {
    setOcupado(true);
    await kioskCancelPayment(orderId);
    setOcupado(false);
    onCancel();
  };

  const pendiente = state === "pending";
  // Sin link no hay QR que enseñar: la tablet volvió de Bold sin que el
  // cliente pagara, y sólo quedan caja o empezar de nuevo.
  const fallido = state === "failed" || (!url && !pendiente);

  return (
    <main className="min-h-svh bg-paper">
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16">
        <div>
          <p className="u-mono text-ink/45">Pedido {orderId}</p>
          <h1 className="u-display mt-2 text-[clamp(2.2rem,6vw,3.6rem)] leading-[0.95]">
            {fallido ? (
              <>
                El pago no se <span className="u-italic text-mango">completó</span>
              </>
            ) : pendiente ? (
              <>
                Tu banco está <span className="u-italic text-ube">confirmando</span>
              </>
            ) : (
              <>
                Paga desde tu <span className="u-italic text-mango">celular</span>
              </>
            )}
          </h1>

          {fallido ? (
            <p className="mt-4 text-xl leading-relaxed text-ink/65">
              {state === "failed"
                ? "No se cobró nada. Puedes pagar en caja y te lo preparamos igual, o empezar de nuevo."
                : "Volviste sin terminar el pago y no se cobró nada. Puedes pagar en caja y te lo preparamos igual, o empezar de nuevo."}
            </p>
          ) : pendiente ? (
            <p className="mt-4 text-xl leading-relaxed text-ink/65">
              Con PSE puede tardar un momento. En cuanto el banco confirme, tu pedido pasa a la barra
              y te llamamos por tu nombre.
            </p>
          ) : (
            <ol className="mt-6 grid gap-3 text-lg text-ink/70">
              {[
                "Abre la cámara de tu celular y apunta al código.",
                "Elige cómo pagar: Nequi, tarjeta, PSE o Botón Bancolombia.",
                "Cuando pagues, esta pantalla lo confirma sola.",
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="u-mono mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-white text-[0.7rem]">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6 flex items-end gap-3">
            <span className="u-mono text-ink/50">Total</span>
            <span className="u-price text-3xl">{money(total)}</span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {!fallido && url ? (
              <a href={url} className="btn btn-ube py-5 text-lg">
                Pagar en esta pantalla
              </a>
            ) : null}
            <button
              type="button"
              onClick={aCaja}
              disabled={ocupado}
              className="btn btn-mango py-5 text-lg disabled:opacity-50"
            >
              {fallido ? "Pagar en caja" : "Mejor pago en caja"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={ocupado}
              className="btn btn-paper py-5 text-lg disabled:opacity-50"
            >
              {fallido ? "Empezar de nuevo" : "Cancelar"}
            </button>
          </div>

          {!fallido ? (
            <p className="u-mono mt-6 flex items-center gap-2 text-ink/40">
              <CupLoader /> Esperando el pago… vuelve al inicio en {restante} s
            </p>
          ) : null}
        </div>

        {qr && !fallido ? (
          <div className="mx-auto w-full max-w-[320px] rounded-[28px] border-[1.5px] border-ink bg-white p-5 shadow-[6px_8px_0_0_var(--color-ink)] lg:mx-0">
            <div
              className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
              // El SVG lo genera la librería a partir del link de Bold: sin
              // datos del cliente ni texto externo.
              dangerouslySetInnerHTML={{ __html: qr }}
              aria-label="Código QR para pagar desde el celular"
              role="img"
            />
            <p className="u-mono mt-4 text-center text-ink/45">Escanéame para pagar</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CupLoader } from "@/components/CupLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "./Logo";
import { useCart } from "./CartProvider";
import { money } from "@/lib/cart";
import InstallApp from "./InstallApp";

/**
 * Vuelta de la pasarela, en cuatro estados:
 *
 * - `confirmed`: Bold dijo que sí. El pedido ya está en la barra.
 * - `pending`:   el banco todavía lo procesa (PSE puede tardar unos minutos).
 *                El cliente puede irse: el webhook remata.
 * - `open`:      el link sigue abierto: el cliente volvió sin pagar. Se le
 *                dice claro y se le deja volver a su pedido.
 * - `waiting`:   no se pudo consultar a Bold al volver, así que se espera
 *                al aviso. Normalmente son segundos.
 *
 * El pago rechazado no llega aquí: la página del servidor manda de vuelta al
 * checkout con el carrito intacto.
 *
 * Mientras no esté confirmado, la página se recarga sola, cada vez más
 * despacio, y a los dos minutos deja de insistir y lo dice.
 */
export type PaymentState = "confirmed" | "pending" | "open" | "waiting";

/** Segundos entre recargas: rápido al principio, luego con calma. */
const RETRY_SECONDS = [2, 3, 5, 8, 10];
const MAX_RETRIES = 14; // ≈ 2 minutos

export default function PaymentResult({
  orderId,
  state,
  mode,
  total,
  signedIn,
}: {
  orderId: string;
  state: PaymentState;
  /**
   * Ausentes si el pedido no es de la cuenta con sesión abierta -incluido
   * cualquier pedido de invitado, que no tiene cuenta que lo reclame-: el id
   * es secuencial y adivinable, así que el monto y el modo sólo se enseñan a
   * quien de verdad es dueño del pedido.
   */
  mode?: "envio" | "recoger";
  total?: number;
  signedIn: boolean;
}) {
  const { clear } = useCart();
  const router = useRouter();
  const confirmed = state === "confirmed";

  const [attempt, setAttempt] = useState(0);
  const gaveUp = attempt >= MAX_RETRIES;

  // El carrito se vacía aquí, no antes de ir a pagar: si el pago se cancela,
  // el pedido sigue intacto.
  useEffect(() => {
    if (confirmed) clear();
  }, [confirmed, clear]);

  useEffect(() => {
    if (confirmed || gaveUp) return;
    // Con el link abierto no hay prisa: sólo por si paga en otra pestaña.
    const seconds =
      state === "open" ? 10 : RETRY_SECONDS[Math.min(attempt, RETRY_SECONDS.length - 1)];
    const t = setTimeout(() => {
      setAttempt((n) => n + 1);
      router.refresh();
    }, seconds * 1000);
    return () => clearTimeout(t);
  }, [confirmed, gaveUp, attempt, state, router]);

  return (
    <main className="min-h-svh bg-paper">
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-5 py-16 text-center">
        <div className="mx-auto flex" aria-hidden="true">
          <span className="h-16 w-16 rounded-full bg-mango" style={{ mixBlendMode: "multiply" }} />
          <span
            className="-ml-6 h-16 w-16 rounded-full bg-ube"
            style={{ mixBlendMode: "multiply" }}
          />
          <span
            className="-ml-6 h-16 w-16 rounded-full bg-matcha"
            style={{ mixBlendMode: "multiply" }}
          />
        </div>

        <div className="mt-6 flex items-center justify-center gap-2.5">
          <Logo size={26} />
          <span className="u-display text-2xl">BLEND</span>
        </div>

        {confirmed ? (
          <>
            <h1 className="u-display mt-6 text-[clamp(2.4rem,9vw,4rem)]">
              Pago recibido, la barra ya lo <span className="u-italic text-mango">tiene</span>
            </h1>
            <p className="u-mono mt-5 text-base tracking-[0.1em]">{orderId}</p>
            {total !== undefined ? (
              <p className="u-mono mt-2 text-ink/45">{money(total)} pagados</p>
            ) : null}
            <p className="mt-4 leading-relaxed text-ink/65">
              {mode === "envio"
                ? "Te llamamos cuando el domiciliario salga. Veinticinco minutos desde ahora."
                : mode === "recoger"
                  ? "Te avisamos cuando esté listo para recoger."
                  : "La barra ya lo tiene y te avisa en cuanto esté listo."}
            </p>
            {/* Buen momento para proponer la app: acaba de pedir y le fue bien. */}
            <InstallApp variant="card" />
          </>
        ) : state === "pending" ? (
          <>
            <h1 className="u-display mt-6 text-[clamp(2.4rem,9vw,4rem)]">
              Tu banco está procesando el <span className="u-italic text-ube">pago</span>
            </h1>
            <p className="u-mono mt-5 text-base tracking-[0.1em]">{orderId}</p>
            <p className="mt-4 leading-relaxed text-ink/65">
              Con PSE puede tardar unos minutos. Puedes cerrar esta página: el pedido pasa a la
              barra en cuanto el banco confirme{signedIn ? ", y lo verás en tus pedidos." : "."}
            </p>
            {!gaveUp ? (
              <CupLoader size={72} label="Esperando al banco…" className="mt-6" />
            ) : (
              <p className="u-mono mt-6 text-ink/45">
                Sigue en proceso. Si el banco lo aprueba, tu pedido sale igual.
              </p>
            )}
          </>
        ) : state === "open" ? (
          <>
            <h1 className="u-display mt-6 text-[clamp(2.4rem,9vw,4rem)]">
              Este pedido aún no está <span className="u-italic text-ube">pagado</span>
            </h1>
            <p className="u-mono mt-5 text-base tracking-[0.1em]">{orderId}</p>
            <p className="mt-4 leading-relaxed text-ink/65">
              Volviste antes de terminar el pago y no se cobró nada. Tu pedido sigue guardado en el
              carrito: vuelve a él y elige cómo pagar.
            </p>
          </>
        ) : (
          <>
            <h1 className="u-display mt-6 text-[clamp(2.4rem,9vw,4rem)]">
              Confirmando tu <span className="u-italic text-ube">pago</span>
            </h1>
            <p className="u-mono mt-5 text-base tracking-[0.1em]">{orderId}</p>
            {!gaveUp ? (
              <>
                <p className="mt-4 leading-relaxed text-ink/65">
                  Tarda unos segundos. No cierres esta página; se actualiza sola.
                </p>
                <CupLoader size={72} label="Esperando a la pasarela…" className="mt-6" />
              </>
            ) : (
              <p className="mt-4 leading-relaxed text-ink/65">
                Está tardando más de lo normal. Si ya pagaste, no te preocupes: el pedido sale a
                la barra en cuanto llegue la confirmación
                {signedIn ? " y lo verás en tus pedidos" : ""}. Si no terminaste el pago, puedes
                volver e intentarlo otra vez.
              </p>
            )}
          </>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {confirmed ? (
            <Link href="/" className="btn btn-mango">
              Volver al menú
            </Link>
          ) : state === "open" ? (
            <Link href="/checkout" className="btn btn-mango">
              Volver a mi pedido
            </Link>
          ) : gaveUp ? (
            <button
              type="button"
              onClick={() => {
                setAttempt(0);
                router.refresh();
              }}
              className="btn btn-mango"
            >
              Volver a comprobar
            </button>
          ) : null}
          {!confirmed && state !== "open" ? (
            <Link href="/checkout" className="btn btn-paper">
              {gaveUp ? "Intentar el pago otra vez" : "Volver a mi pedido"}
            </Link>
          ) : null}
          <Link href={signedIn ? "/cuenta" : "/cuenta/registro"} className="btn btn-paper">
            {signedIn ? "Ver mis pedidos" : "Crear una cuenta"}
          </Link>
        </div>
      </div>
    </main>
  );
}

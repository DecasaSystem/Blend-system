"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "./Logo";
import { useCart } from "./CartProvider";
import { money } from "@/lib/cart";

/**
 * Vuelta de la pasarela.
 *
 * El aviso firmado de Stripe puede tardar un par de segundos en llegar, así que
 * si el pedido todavía no está confirmado la página se recarga sola en vez de
 * afirmar algo que no sabe.
 */
export default function PaymentResult({
  orderId,
  confirmed,
  mode,
  total,
  signedIn,
}: {
  orderId: string;
  confirmed: boolean;
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

  // El carrito se vacía aquí, no antes de ir a pagar: si el pago se cancela,
  // el pedido sigue intacto.
  useEffect(() => {
    if (confirmed) clear();
  }, [confirmed, clear]);

  useEffect(() => {
    if (confirmed) return;
    const t = setTimeout(() => router.refresh(), 2500);
    return () => clearTimeout(t);
  }, [confirmed, router]);

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
          </>
        ) : (
          <>
            <h1 className="u-display mt-6 text-[clamp(2.4rem,9vw,4rem)]">
              Confirmando tu <span className="u-italic text-ube">pago</span>
            </h1>
            <p className="u-mono mt-5 text-base tracking-[0.1em]">{orderId}</p>
            <p className="mt-4 leading-relaxed text-ink/65">
              Tarda unos segundos. No cierres esta página; se actualiza sola.
            </p>
          </>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-mango">
            Volver al menú
          </Link>
          <Link href={signedIn ? "/cuenta" : "/cuenta/registro"} className="btn btn-paper">
            {signedIn ? "Ver mis pedidos" : "Crear una cuenta"}
          </Link>
        </div>
      </div>
    </main>
  );
}

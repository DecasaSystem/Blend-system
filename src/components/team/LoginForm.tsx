"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Logo from "../Logo";
import InkField from "../InkField";
import { usePasswordEye } from "../PasswordEye";
import { signIn, type SignInState } from "@/actions/auth";

export default function LoginForm() {
  const [state, action] = useActionState<SignInState, FormData>(signIn, {});
  const clave = usePasswordEye();

  return (
    <main className="relative min-h-svh overflow-hidden bg-ink text-paper">
      <InkField
        tone="dark"
        blobs={[
          { color: "#7B3FF2", size: 46, x: -12, y: 8, opacity: 0.4 },
          { color: "#FF6A1A", size: 34, x: 66, y: 46, opacity: 0.3 },
        ]}
      />

      <div className="relative mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-16">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <span className="u-display text-3xl">BLEND</span>
          <span className="u-mono ml-auto text-paper/40">Barra</span>
        </div>

        <h1 className="u-display mt-10 text-[clamp(2.4rem,9vw,3.6rem)]">
          Entra a los <span className="u-italic text-mango">pedidos</span>
        </h1>
        <p className="mt-4 text-paper/65">Solo para el equipo de tienda.</p>

        <form action={action} onSubmit={clave.hide} className="mt-8">
          <label className="u-mono mb-2 block text-paper/50" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="tu@blend.cafe"
            className="w-full rounded-full border-[1.5px] border-paper/30 bg-transparent px-5 py-3.5 text-base text-paper outline-none placeholder:text-paper/35 focus:border-paper"
          />

          <label className="u-mono mb-2 mt-4 block text-paper/50" htmlFor="password">
            Contraseña
          </label>
          {/* `relative` para que el ojo se posicione dentro del campo, y `pr-14`
              para que el texto largo no pase por debajo del botón. */}
          <div className="relative">
            <input
              id="password"
              name="password"
              type={clave.type}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              aria-describedby={state.error ? "login-error" : undefined}
              className={`w-full rounded-full border-[1.5px] bg-transparent py-3.5 pl-5 pr-14 text-base text-paper outline-none placeholder:text-paper/35 focus:border-paper ${
                state.error ? "border-mango" : "border-paper/30"
              }`}
            />
            {clave.eye}
          </div>

          {state.error ? (
            <p id="login-error" className="u-mono mt-3 text-mango" role="alert">
              {state.error}
            </p>
          ) : null}

          <SubmitButton />
        </form>

        <Link
          href="/"
          className="btn btn-ghost mt-4 self-start border-paper/30 text-paper hover:bg-paper/10"
        >
          ← Volver a la tienda
        </Link>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-mango mt-6 w-full disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

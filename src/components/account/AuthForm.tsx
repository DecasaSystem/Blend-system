"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import AccountShell from "./AccountShell";
import GoogleButton from "./GoogleButton";
import { signIn, signUp, type AccountState } from "@/actions/account";

/** Entrar y crear cuenta comparten forma: sólo cambian los campos. */
export default function AuthForm({
  mode,
  googleClientId,
}: {
  mode: "entrar" | "registro";
  /** Vacío si no está configurado: entonces sólo hay correo y contraseña. */
  googleClientId?: string;
}) {
  const isSignUp = mode === "registro";
  const [state, action] = useActionState<AccountState, FormData>(isSignUp ? signUp : signIn, {});

  return (
    <AccountShell
      eyebrow="Tu cuenta"
      title={isSignUp ? "Crea tu" : "Entra a tu"}
      accent="cuenta"
      lead={
        isSignUp
          ? "Para guardar tus direcciones, ver lo que has pedido y acumular sellos."
          : "Tus pedidos, tus direcciones y tus sellos, donde los dejaste."
      }
    >
      {googleClientId ? (
        <div className="mt-8">
          <GoogleButton clientId={googleClientId} oneTap />
          <div className="mt-6 flex items-center gap-3" aria-hidden="true">
            <span className="rule flex-1" />
            <span className="u-mono text-ink/35">o con tu correo</span>
            <span className="rule flex-1" />
          </div>
        </div>
      ) : null}

      <form action={action} className="mt-8 grid gap-4">
        {isSignUp ? (
          <Field
            label="Nombre"
            name="name"
            autoComplete="name"
            placeholder="Camila Ruiz"
            required
          />
        ) : null}

        <Field
          label="Correo"
          name="email"
          type="email"
          autoComplete={isSignUp ? "email" : "username"}
          placeholder="camila@correo.com"
          required
        />

        {isSignUp ? (
          <Field
            label="Teléfono"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="310 123 4567"
            hint="Para avisarte cuando salga tu pedido"
          />
        ) : null}

        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder="••••••••"
          required
          hint={isSignUp ? "Mínimo 10 caracteres" : undefined}
          invalid={Boolean(state.error)}
        />

        {state.error ? (
          <p id="account-error" className="u-mono text-mango-deep" role="alert">
            {state.error}
          </p>
        ) : null}

        <Submit label={isSignUp ? "Crear cuenta" : "Entrar"} />
      </form>

      <div className="rule my-6" />

      <p className="text-ink/60">
        {isSignUp ? "¿Ya tienes cuenta? " : "¿Primera vez? "}
        <Link
          href={isSignUp ? "/cuenta/entrar" : "/cuenta/registro"}
          className="font-medium text-ube underline-offset-4 hover:underline"
        >
          {isSignUp ? "Entra aquí" : "Crea una cuenta"}
        </Link>
      </p>

      <p className="u-mono mt-4 normal-case tracking-[0.01em] text-ink/40">
        También puedes pedir sin cuenta: solo te pedimos nombre, teléfono y dirección al pagar.
      </p>

      <Link href="/" className="btn btn-paper mt-8">
        ← Volver a la tienda
      </Link>
    </AccountShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
  hint,
  invalid,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-2 block text-ink/45">{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={invalid ? "account-error" : undefined}
        className={`input ${invalid ? "border-mango" : ""}`}
      />
      {hint ? <span className="u-mono mt-1.5 block text-ink/35">{hint}</span> : null}
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-mango mt-2 w-full disabled:opacity-60"
    >
      {pending ? "Un momento…" : label}
    </button>
  );
}

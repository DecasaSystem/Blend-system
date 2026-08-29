import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/team/LoginForm";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "BLEND · Entrar",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Con sesión abierta no tiene sentido pedir la clave otra vez.
  if (await getSessionUser()) redirect("/equipo");
  return <LoginForm />;
}

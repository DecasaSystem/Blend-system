import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/team/LoginForm";
import { safeNext } from "@/lib/safe-next";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Con sesión abierta no tiene sentido pedir la clave otra vez.
  if (await getSessionUser()) redirect(safeNext(next, "/equipo", "/equipo"));
  return <LoginForm next={next} />;
}

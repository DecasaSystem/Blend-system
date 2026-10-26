import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/account/AuthForm";
import { getCustomer } from "@/lib/customer-session";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: { index: false, follow: false },
};

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCustomer()) redirect(safeNext(next, "/", "/cuenta"));
  return (
    <AuthForm
      mode="registro"
      googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
      next={next}
    />
  );
}

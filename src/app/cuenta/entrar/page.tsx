import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/account/AuthForm";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCustomer()) redirect("/cuenta");
  const { next } = await searchParams;
  return (
    <AuthForm
      mode="entrar"
      googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
      next={next}
    />
  );
}

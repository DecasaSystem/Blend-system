import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/account/AuthForm";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = { title: "BLEND · Entrar" };

export default async function EntrarPage() {
  if (await getCustomer()) redirect("/cuenta");
  return <AuthForm mode="entrar" googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} />;
}

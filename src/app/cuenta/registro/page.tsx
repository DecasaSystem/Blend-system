import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/account/AuthForm";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = { title: "BLEND · Crear cuenta" };

export default async function RegistroPage() {
  if (await getCustomer()) redirect("/cuenta");
  return <AuthForm mode="registro" googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} />;
}

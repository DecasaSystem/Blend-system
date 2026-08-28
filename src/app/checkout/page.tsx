import type { Metadata } from "next";
import CheckoutSummary from "@/components/CheckoutSummary";

export const metadata: Metadata = { title: "BLEND · Tu pedido" };

export default function CheckoutPage() {
  return <CheckoutSummary />;
}

import type { Metadata } from "next";
import CheckoutSummary from "@/components/CheckoutSummary";
import { myAddresses } from "@/actions/account";
import { cardPaymentsAvailable } from "@/actions/checkout";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = { title: "BLEND · Tu pedido" };

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string }>;
}) {
  const [customer, cardPayments, params] = await Promise.all([
    getCustomer(),
    cardPaymentsAvailable(),
    searchParams,
  ]);
  const addresses = customer ? await myAddresses() : [];

  return (
    <CheckoutSummary
      customer={customer}
      addresses={addresses.map((a) => ({ id: a.id, label: a.label, address: a.address }))}
      cardPayments={cardPayments}
      cancelled={params.cancelado === "1"}
    />
  );
}

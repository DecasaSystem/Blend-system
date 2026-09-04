import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountPanel from "@/components/account/AccountPanel";
import { myAddresses, myOrders, myStamps } from "@/actions/account";
import { getCustomer } from "@/lib/customer-session";

export const metadata: Metadata = {
  title: "BLEND · Tu cuenta",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/cuenta/entrar");

  const [orders, addresses, stamps] = await Promise.all([myOrders(), myAddresses(), myStamps()]);

  return (
    <AccountPanel
      customer={customer}
      orders={orders}
      addresses={addresses.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        notes: a.notes,
      }))}
      stamps={stamps}
    />
  );
}

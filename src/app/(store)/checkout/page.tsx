import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getCart } from "@/server/actions/cart";

export const metadata: Metadata = { title: "Secure checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const [cart, addresses] = await Promise.all([
    getCart(),
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);
  if (cart.items.length === 0) redirect("/bag");
  return (
    <div className="container-luxe py-8 pb-24 md:py-12">
      <h1 className="text-4xl md:text-6xl">Secure checkout</h1>
      <CheckoutView addresses={addresses} />
    </div>
  );
}

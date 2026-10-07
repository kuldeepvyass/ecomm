import type { Metadata } from "next";
import { BagView } from "@/components/bag/bag-view";
import { getCart } from "@/server/actions/cart";

export const metadata: Metadata = { title: "Your Bag", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BagPage() {
  const cart = await getCart();
  return (
    <div className="container-luxe py-8 pb-32 md:py-12">
      <h1 className="mb-8 text-4xl md:text-6xl">Your bag</h1>
      <BagView initial={cart} />
    </div>
  );
}

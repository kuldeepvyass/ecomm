import type { Metadata } from "next";
import { WishlistView } from "./wishlist-view";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="container-luxe py-8 md:py-12">
      <h1 className="mb-8 text-4xl md:text-6xl">Wishlist</h1>
      <WishlistView />
    </div>
  );
}

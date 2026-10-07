"use client";

import { Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useStore } from "@/components/providers";
import { ProductCard, ProductCardSkeleton } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { addToBag } from "@/server/actions/cart";
import type { ProductCardData } from "@/server/catalog/types";

export function WishlistView() {
  const { wishlist, loaded, user, toggleWishlist, setCartCount } = useStore();
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const [pending, start] = useTransition();
  const ids = [...wishlist];
  const key = ids.join(",");

  useEffect(() => {
    if (!loaded) return;
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- empty wishlist
      setItems([]);
      return;
    }
    fetch(`/api/products?ids=${key}`).then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [key, loaded]);

  function moveToBag(p: ProductCardData) {
    start(async () => {
      const res = await addToBag(p.id, 1);
      if (!res.ok) return void toast.error(res.error);
      setCartCount(res.data.count);
      await toggleWishlist(p.id);
      toast.success("Moved to your bag");
    });
  }

  if (items === null) {
    return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>;
  }
  if (items.length === 0) {
    return (
      <EmptyState icon={<Heart />} title="Your wishlist is empty" description="Tap the heart on any watch to save it here."
        action={<Button asChild><Link href="/watches">Discover watches</Link></Button>} />
    );
  }
  const visible = items.filter((p) => wishlist.has(p.id));
  return (
    <>
      {!user && <p className="mb-6 text-sm text-fg-muted"><Link href="/sign-in?callbackUrl=/wishlist" className="text-gold underline underline-offset-4 hover:decoration-2">Sign in</Link> to keep your wishlist across devices.</p>}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
        {visible.map((p) => (
          <li key={p.id} className="flex flex-col gap-3">
            <ProductCard product={p} />
            <Button variant="outline" size="sm" disabled={pending || p.stock === 0} onClick={() => moveToBag(p)}>
              <ShoppingBag aria-hidden /> {p.stock === 0 ? "Sold out" : "Move to bag"}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

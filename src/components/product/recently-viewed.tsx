"use client";

import { useEffect, useState } from "react";
import { ProductCard, ProductCardSkeleton } from "@/components/product/product-card";
import { KEYS, readList, writeList } from "@/lib/client/storage";
import type { ProductCardData } from "@/server/catalog/types";

const MAX = 12;

export function trackRecentlyViewed(productId: string) {
  const list = readList(KEYS.recent).filter((id) => id !== productId);
  writeList(KEYS.recent, [productId, ...list].slice(0, MAX));
}

/** Records a product view (localStorage) — rendered invisibly on product pages. */
export function TrackView({ productId }: { productId: string }) {
  useEffect(() => {
    trackRecentlyViewed(productId);
    void fetch(`/api/products/${productId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [productId]);
  return null;
}

export function RecentlyViewed({ excludeId, title = "Recently viewed" }: { excludeId?: string; title?: string }) {
  const [items, setItems] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    const ids = readList(KEYS.recent).filter((id) => id !== excludeId).slice(0, 8);
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing stored locally
      setItems([]);
      return;
    }
    fetch(`/api/products?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((d: { items: ProductCardData[] }) => setItems(d.items))
      .catch(() => setItems([]));
  }, [excludeId]);

  if (items !== null && items.length === 0) return null;
  return (
    <section className="container-luxe py-16 md:py-24" aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="mb-8 text-3xl md:text-4xl">{title}</h2>
      <div tabIndex={0} role="region" aria-label="Recently viewed watches" className="-mx-5 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:px-0 lg:grid-cols-6">
        {items === null
          ? Array.from({ length: 4 }, (_, i) => <div key={i} className="w-[42vw] shrink-0 md:w-auto"><ProductCardSkeleton /></div>)
          : items.map((p) => (
              <ProductCard key={p.id} product={p} className="w-[42vw] shrink-0 snap-start md:w-auto" sizes="(min-width: 1024px) 15vw, (min-width: 768px) 22vw, 42vw" />
            ))}
      </div>
    </section>
  );
}

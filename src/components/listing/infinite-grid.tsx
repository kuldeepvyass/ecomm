"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard, ProductCardSkeleton } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import type { ProductCardData } from "@/server/catalog/types";

/** First page is server-rendered; further pages stream in via cursor pagination as the user scrolls. */
export function InfiniteGrid({ initial, initialCursor, fixed = {} }: {
  initial: ProductCardData[];
  initialCursor: string | null;
  fixed?: Record<string, string>;
}) {
  const sp = useSearchParams();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const key = sp.toString();

  // Reset when filters change (server re-renders with new initial data).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync to new server page
    setItems(initial);
    setCursor(initialCursor);
  }, [initial, initialCursor, key]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(fixed)) params.set(k, v);
      params.set("cursor", cursor);
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error();
      const page: { items: ProductCardData[]; nextCursor: string | null } = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, sp, fixed]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-12 xl:grid-cols-3 2xl:grid-cols-4" data-testid="product-grid">
        {items.map((p, i) => (
          <li key={p.id}><ProductCard product={p} priority={i < 2} /></li>
        ))}
        {loading && Array.from({ length: 4 }, (_, i) => <li key={`sk${i}`}><ProductCardSkeleton /></li>)}
      </ul>
      <div ref={sentinel} className="mt-10 flex justify-center">
        {cursor && !loading && (
          <Button variant="outline" onClick={() => void loadMore()}>{error ? "Retry" : "Load more"}</Button>
        )}
        {loading && <Loader2 className="size-5 animate-spin text-fg-muted" aria-label="Loading more watches" />}
        {!cursor && items.length > 12 && <p className="text-sm text-fg-subtle">You&apos;ve seen the whole collection.</p>}
      </div>
    </>
  );
}

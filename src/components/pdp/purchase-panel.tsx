"use client";

import { Check, GitCompareArrows, Share2, ShoppingBag } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useStore } from "@/components/providers";
import { PriceTag } from "@/components/product/price-tag";
import { WishlistButton } from "@/components/product/wishlist-button";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { addToBag } from "@/server/actions/cart";
import { requestStockAlert } from "@/server/actions/stock-alert";

type Props = {
  productId: string;
  label: string;
  mrp: number;
  price: number;
  stock: number;
  lowStockAt: number;
};

export function PurchasePanel({ productId, label, mrp, price, stock, lowStockAt }: Props) {
  const router = useRouter();
  const { setCartCount, toggleCompare, compare } = useStore();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const mainBtn = useRef<HTMLDivElement>(null);
  const soldOut = stock <= 0;
  const inCompare = compare.includes(productId);

  useEffect(() => {
    const el = mainBtn.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStickyVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function add() {
    start(async () => {
      const res = await addToBag(productId, 1);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCartCount(res.data.count);
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
      toast.success(res.message ?? "Added to your bag", { action: { label: "View bag", onClick: () => router.push("/bag") } });
    });
  }

  async function share() {
    const data = { title: label, text: `${label} — ${formatINR(price)}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div>
          <PriceTag mrp={mrp} price={price} size="lg" />
          <p className="mt-1 text-xs text-fg-subtle">Inclusive of all taxes (GST)</p>
          <p className="mt-2 text-sm text-fg-muted">Pay by UPI — Google Pay, PhonePe, Paytm or any UPI app. <span className="text-fg">No payment fees.</span></p>
        </div>

        <p className="text-sm" data-testid="stock-status">
          {soldOut ? (
            <span className="text-danger">Sold out</span>
          ) : stock <= lowStockAt ? (
            <span className="text-warning">Only {stock} left — order soon</span>
          ) : (
            <span className="text-success">In stock · ready to ship</span>
          )}
        </p>

        <div ref={mainBtn} className="flex gap-3">
          {soldOut ? (
            <BackInStock productId={productId} />
          ) : (
            <Button size="lg" className="flex-1" onClick={add} loading={pending} data-testid="add-to-bag">
              {added ? (
                <span key="ok" className="flex animate-fade-up items-center gap-2"><Check aria-hidden /> Added</span>
              ) : (
                <span key="add" className="flex items-center gap-2"><ShoppingBag aria-hidden /> Add to bag</span>
              )}
            </Button>
          )}
          <WishlistButton productId={productId} label={label} variant="outline" className="size-14 rounded-[2px]" testId="pdp-wishlist" />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <button type="button" onClick={() => toggleCompare(productId)} aria-pressed={inCompare}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted hover:text-gold" data-testid="compare-toggle">
            <GitCompareArrows className="size-4" aria-hidden /> {inCompare ? "Added to compare" : "Compare"}
          </button>
          {inCompare && compare.length > 1 && (
            <a href="/compare" className="inline-flex min-h-11 items-center text-sm text-gold underline underline-offset-4 hover:decoration-2">
              Compare {compare.length} watches →
            </a>
          )}
          <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted hover:text-gold">
            <Share2 className="size-4" aria-hidden /> Share
          </button>
        </div>
      </div>

      {/* Sticky Add to Bag (mobile) */}
      <AnimatePresence>
        {stickyVisible && !soldOut && (
          <m.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md md:hidden" data-testid="sticky-bag-bar">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-fg-muted">{label}</p>
                <p className="font-medium">{formatINR(price)}</p>
              </div>
              <Button onClick={add} loading={pending}><ShoppingBag aria-hidden /> Add to bag</Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function BackInStock({ productId }: { productId: string }) {
  const { user } = useStore();
  const [state, action, pending] = useActionState(requestStockAlert, null);
  if (state?.ok) return <p className="flex-1 border border-success/40 bg-success/10 p-3 text-sm text-success">{state.message}</p>;
  return (
    <form action={action} className="flex flex-1 flex-col gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor="alert-email" className="text-sm text-fg-muted">Notify me when it&apos;s back in stock</label>
      <div className="flex gap-2">
        <input id="alert-email" name="email" type="email" required defaultValue={user?.email ?? ""} placeholder="Email address" autoComplete="email"
          className="h-12 min-w-0 flex-1 rounded-[2px] border border-border bg-surface px-4 focus:border-gold focus:outline-none" />
        <Button type="submit" loading={pending}>Notify me</Button>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.fieldErrors?.email?.[0] ?? state.error}</p>}
    </form>
  );
}

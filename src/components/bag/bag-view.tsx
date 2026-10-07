"use client";

import { Lock, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useStore } from "@/components/providers";
import { PriceTag } from "@/components/product/price-tag";
import { WatchImage } from "@/components/product/watch-image";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { applyCoupon, removeCoupon, removeItem, setQuantity, setSavedForLater } from "@/server/actions/cart";
import type { CartLine, CartView } from "@/server/cart/service";
import type { ActionResult } from "@/server/actions/result";
import { PriceBreakdown } from "./order-summary";

export function BagView({ initial }: { initial: CartView }) {
  const { setCartCount, user } = useStore();
  const [cart, setCart] = useState(initial);
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");

  function run(fn: () => Promise<ActionResult<CartView>>, success?: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCart(res.data);
      setCartCount(res.data.count);
      if (success ?? res.message) toast.success(success ?? res.message);
    });
  }

  if (cart.items.length === 0 && cart.saved.length === 0) {
    return (
      <EmptyState icon={<ShoppingBag />} title="Your bag is empty" description="Discover pieces chosen by our specialists."
        action={<Button asChild><Link href="/watches">Explore watches</Link></Button>} />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16" aria-busy={pending}>
      <div>
        {cart.items.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border" data-testid="bag-items">
            {cart.items.map((l) => (
              <Line key={l.itemId} line={l} disabled={pending}
                onQty={(q) => run(() => setQuantity(l.itemId, q))}
                onRemove={() => run(() => removeItem(l.itemId), "Removed from bag")}
                onSave={() => run(() => setSavedForLater(l.itemId, true), "Saved for later")} />
            ))}
          </ul>
        ) : (
          <p className="border-y border-border py-10 text-center text-fg-muted">Nothing in your bag right now.</p>
        )}

        {cart.saved.length > 0 && (
          <section className="mt-12" aria-labelledby="saved-heading">
            <h2 id="saved-heading" className="mb-4 text-2xl">Saved for later ({cart.saved.length})</h2>
            <ul className="divide-y divide-border border-y border-border">
              {cart.saved.map((l) => (
                <Line key={l.itemId} line={l} saved disabled={pending}
                  onRemove={() => run(() => removeItem(l.itemId), "Removed")}
                  onSave={() => run(() => setSavedForLater(l.itemId, false), "Moved to bag")} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {cart.items.length > 0 && (
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Order summary">
          <div className="border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-5 text-2xl">Summary</h2>
            {cart.coupon ? (
              <div className="mb-5 flex items-center justify-between gap-3 border border-dashed border-gold/60 bg-gold-soft px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Tag className="size-4 text-gold" aria-hidden /> <strong>{cart.coupon.code}</strong> applied</span>
                <button type="button" onClick={() => run(removeCoupon, "Coupon removed")} className="grid size-9 place-items-center hover:text-gold" aria-label="Remove coupon">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <form className="mb-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) run(() => applyCoupon(code)); }}>
                <label htmlFor="coupon" className="sr-only">Coupon code</label>
                <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" autoCapitalize="characters"
                  className="h-11 min-w-0 flex-1 rounded-[2px] border border-border bg-bg px-3 text-sm uppercase tracking-wider focus:border-gold focus:outline-none" data-testid="coupon-input" />
                <Button type="submit" variant="outline" size="sm" className="h-11" disabled={!code.trim()}>Apply</Button>
              </form>
            )}
            {cart.couponError && <p className="mb-4 text-sm text-danger">{cart.couponError}</p>}
            <PriceBreakdown mrpTotal={cart.mrpTotal} itemsTotal={cart.itemsTotal} couponDiscount={cart.coupon?.discount ?? 0}
              couponCode={cart.coupon?.code} shippingFee={cart.shippingFee} total={cart.total} />
            {cart.freeShippingThreshold && cart.shippingFee > 0 && (
              <p className="mt-3 text-xs text-fg-muted">Add {formatINR(cart.freeShippingThreshold - cart.itemsTotal)} more for free insured shipping.</p>
            )}
            {cart.hasUnavailable && <p className="mt-4 text-sm text-danger">Some items are unavailable in the requested quantity. Update them to continue.</p>}
            <Button asChild={!cart.hasUnavailable} block size="lg" className="mt-6" disabled={cart.hasUnavailable} data-testid="checkout-button">
              {cart.hasUnavailable ? <span>Checkout</span> : <Link href={user ? "/checkout" : "/sign-in?callbackUrl=/checkout"}><Lock aria-hidden /> Secure checkout</Link>}
            </Button>
            <p className="mt-3 text-center text-xs text-fg-subtle">UPI · no payment fees · prices inclusive of GST</p>
          </div>
        </aside>
      )}

      {/* Mobile sticky checkout bar */}
      {cart.items.length > 0 && !cart.hasUnavailable && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex-1">
            <p className="text-xs text-fg-muted">Total</p>
            <p className="font-medium">{formatINR(cart.total)}</p>
          </div>
          <Button asChild><Link href={user ? "/checkout" : "/sign-in?callbackUrl=/checkout"}><Lock aria-hidden /> Checkout</Link></Button>
        </div>
      )}
    </div>
  );
}

function Line({ line: l, saved, disabled, onQty, onRemove, onSave }: {
  line: CartLine; saved?: boolean; disabled?: boolean; onQty?: (q: number) => void; onRemove: () => void; onSave: () => void;
}) {
  return (
    <li className="flex gap-4 py-5" data-testid="bag-line">
      <Link href={l.href} className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-surface-2 md:w-32">
        {l.image && <WatchImage src={l.image.url} alt={l.image.alt} fill sizes="128px" blurDataUrl={l.image.blurDataUrl} className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="small-caps text-xs text-fg-muted">{l.brand} {l.isDemo && <Badge tone="outline" className="ml-1 h-5">Sample</Badge>}</p>
        <Link href={l.href} className="font-display text-xl leading-tight hover:text-gold">{l.modelName}</Link>
        <p className="text-xs text-fg-subtle">Ref. {l.reference}</p>
        <PriceTag mrp={l.mrp} price={l.unitPrice} size="sm" className="mt-1" />
        {!l.available && <p className="text-sm text-danger">{l.stock === 0 ? "Sold out" : `Only ${l.stock} available`}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
          {!saved && onQty && (
            <div className="flex items-center border border-border" role="group" aria-label="Quantity">
              <button type="button" disabled={disabled || l.quantity <= 1} onClick={() => onQty(l.quantity - 1)} className="grid size-11 place-items-center disabled:opacity-40" aria-label="Decrease quantity"><Minus className="size-4" aria-hidden /></button>
              <span className="w-8 text-center text-sm" aria-live="polite">{l.quantity}</span>
              <button type="button" disabled={disabled || l.quantity >= Math.min(10, l.stock)} onClick={() => onQty(l.quantity + 1)} className="grid size-11 place-items-center disabled:opacity-40" aria-label="Increase quantity"><Plus className="size-4" aria-hidden /></button>
            </div>
          )}
          <button type="button" onClick={onSave} disabled={disabled} className={cn("min-h-11 text-xs uppercase tracking-[0.12em] text-fg-muted hover:text-gold")}>
            {saved ? "Move to bag" : "Save for later"}
          </button>
          <button type="button" onClick={onRemove} disabled={disabled} className="grid size-11 place-items-center text-fg-muted hover:text-danger" aria-label={`Remove ${l.modelName}`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

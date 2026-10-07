"use client";

import { Loader2, Lock, MapPin, Plus, QrCode, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AddressForm } from "@/components/account/address-form";
import { PriceBreakdown } from "@/components/bag/order-summary";
import { useStore } from "@/components/providers";
import { WatchImage } from "@/components/product/watch-image";
import { Button } from "@/components/ui/button";
import { stateName } from "@/lib/india";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getQuote, submitOrder, type QuoteView } from "@/server/actions/checkout";

type Address = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; isDefault: boolean };

function Step({ n, title, icon, children }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-6" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-4 flex items-center gap-3 font-display text-2xl">
        <span className="grid size-8 place-items-center rounded-full border border-gold text-sm text-gold [font-family:var(--font-sans)]">{n}</span>
        {title}
        <span className="ml-auto text-fg-subtle [&_svg]:size-5" aria-hidden>{icon}</span>
      </h2>
      {children}
    </section>
  );
}

export function CheckoutView({ addresses: initialAddresses }: { addresses: Address[] }) {
  const router = useRouter();
  const { setCartCount } = useStore();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [deliveryOption, setDeliveryOption] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [placing, setPlacing] = useState(false);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const refreshQuote = useCallback(() => {
    if (!addressId) return;
    startQuote(async () => {
      const res = await getQuote({ addressId, paymentMethod: "UPI", deliveryOption });
      if (res.ok) {
        setQuote(res.data);
        setQuoteError(null);
      } else {
        setQuoteError(res.error);
      }
    });
  }, [addressId, deliveryOption]);

  useEffect(() => { refreshQuote(); }, [refreshQuote]);

  async function reloadAddresses(selectId: string) {
    const res = await fetch("/api/me/addresses", { cache: "no-store" });
    if (res.ok) setAddresses((await res.json()).addresses);
    setAddressId(selectId);
    setAdding(false);
  }

  async function place() {
    if (!addressId) return toast.error("Choose a delivery address first.");
    setPlacing(true);
    const res = await submitOrder({ addressId, paymentMethod: "UPI", deliveryOption, idempotencyKey });
    if (!res.ok) {
      toast.error(res.error);
      setPlacing(false);
      refreshQuote();
      return;
    }
    setCartCount(0);
    router.replace(`/checkout/pay/${res.data.orderId}`);
  }

  const selected = addresses.find((a) => a.id === addressId);
  const totals = quote?.totals;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_26rem] lg:gap-16">
      <div>
        <Step n={1} title="Delivery address" icon={<MapPin />}>
          {addresses.length > 0 && !adding && (
            <fieldset>
              <legend className="sr-only">Choose an address</legend>
              <ul className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <label className={cn("flex h-full cursor-pointer gap-3 border p-4 text-sm transition-colors", a.id === addressId ? "border-gold bg-gold-soft" : "border-border hover:border-border-strong")}>
                      <input type="radio" name="address" value={a.id} checked={a.id === addressId} onChange={() => setAddressId(a.id)} className="mt-1 size-4 accent-[var(--gold)]" />
                      <span>
                        <span className="font-medium">{a.fullName}</span>{a.label && <span className="ml-2 text-xs uppercase tracking-wider text-fg-muted">{a.label}</span>}
                        <span className="mt-1 block text-fg-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? `, near ${a.landmark}` : ""}<br />{a.city}, {stateName(a.state)} {a.pincode}<br />+91 {a.phone}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button variant="link" className="mt-4" onClick={() => setAdding(true)}><Plus aria-hidden /> Add a new address</Button>
            </fieldset>
          )}
          {adding && (
            <AddressForm onSaved={(id) => void reloadAddresses(id)} onCancel={addresses.length ? () => setAdding(false) : undefined} submitLabel="Deliver here" />
          )}
        </Step>

        <Step n={2} title="Delivery" icon={<Truck />}>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Delivery option</legend>
            {[
              { v: "STANDARD" as const, t: "Insured standard", d: quote?.delivery ? `Arrives ${quote.delivery.from} – ${quote.delivery.to}` : "3–6 business days", fee: null },
              ...(quote?.express.available ? [{ v: "EXPRESS" as const, t: "Insured express", d: "Priority dispatch within 24 hours", fee: quote.express.fee }] : []),
            ].map((o) => (
              <label key={o.v} className={cn("flex cursor-pointer gap-3 border p-4 text-sm transition-colors", deliveryOption === o.v ? "border-gold bg-gold-soft" : "border-border hover:border-border-strong")}>
                <input type="radio" name="delivery" checked={deliveryOption === o.v} onChange={() => setDeliveryOption(o.v)} className="mt-1 size-4 accent-[var(--gold)]" />
                <span className="flex-1"><span className="font-medium">{o.t}</span><span className="block text-fg-muted">{o.d}</span></span>
                <span>{o.fee ? `+ ${formatINR(o.fee)}` : ""}</span>
              </label>
            ))}
          </fieldset>
        </Step>

        <Step n={3} title="Payment" icon={<Lock />}>
          <div className="flex gap-3 border border-gold bg-gold-soft p-4 text-sm" data-testid="pay-upi">
            <QrCode className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
            <span className="flex-1">
              <span className="flex items-center gap-2 font-medium">UPI <span className="rounded-full bg-success/15 px-2 py-0.5 text-[0.625rem] uppercase tracking-wider text-success">No fees</span></span>
              <span className="block text-fg-muted">{quote && !quote.upi.allowed ? quote.upi.reason : "Google Pay, PhonePe, Paytm, BHIM or any UPI app — scan or tap to pay on the next screen, straight to the boutique."}</span>
            </span>
          </div>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Order summary">
        <div className="border border-border bg-surface p-5 md:p-6">
          <h2 className="mb-4 text-2xl">Order summary</h2>
          {quoteError && <p role="alert" className="mb-4 border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{quoteError}</p>}
          {!quote && !quoteError && <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-fg-muted" aria-label="Calculating" /></div>}
          {quote && totals && (
            <div className={cn("transition-opacity", quoting && "opacity-60")}>
              <ul className="mb-5 divide-y divide-border">
                {quote.lines.map((l) => (
                  <li key={l.productId} className="flex gap-3 py-3">
                    <span className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-surface-2">
                      {l.imageUrl && <WatchImage src={l.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="flex-1 text-sm">
                      <span className="small-caps block text-xs text-fg-muted">{l.brandName}</span>
                      {l.modelName} <span className="text-fg-muted">× {l.quantity}</span>
                    </span>
                    <span className="text-sm">{formatINR(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <PriceBreakdown mrpTotal={totals.mrpTotal} itemsTotal={totals.itemsTotal} couponDiscount={totals.couponDiscount}
                couponCode={quote.coupon?.code} shippingFee={totals.shippingFee} total={totals.grandTotal} />
              {quote.couponError && <p className="mt-3 text-sm text-danger">Coupon removed: {quote.couponError}</p>}
              <p className="mt-3 text-xs text-fg-subtle">
                Includes GST of {formatINR(totals.cgst + totals.sgst + totals.igst)} ({totals.igst ? "IGST" : "CGST + SGST"}). A GST invoice will be available with your order.
              </p>
            </div>
          )}
          <Button block size="lg" className="mt-6" onClick={place} loading={placing} disabled={!quote || !!quoteError || !selected || quoting} data-testid="place-order">
            <Lock aria-hidden /> Continue to pay {totals ? formatINR(totals.grandTotal) : ""}
          </Button>
          <p className="mt-3 text-center text-xs text-fg-subtle">By placing your order you agree to our Terms and Refund policy.</p>
        </div>
      </aside>

    </div>
  );
}

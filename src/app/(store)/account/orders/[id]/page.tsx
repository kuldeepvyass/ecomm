import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline } from "@/components/account/order-timeline";
import { StatusBadge } from "@/components/account/status-badge";
import { PriceBreakdown } from "@/components/bag/order-summary";
import { WatchImage } from "@/components/product/watch-image";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { db } from "@/lib/db";
import { stateName } from "@/lib/india";
import { formatINR } from "@/lib/money";
import { isCustomerCancellable, isReturnEligible } from "@/lib/orders/transitions";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/server/settings";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  const [order, settings] = await Promise.all([
    db.order.findFirst({
      where: { id, userId: user.id },
      include: {
        items: { include: { product: { select: { slug: true, brand: { select: { slug: true } } } }, review: { select: { id: true, status: true } } } },
        events: { orderBy: { createdAt: "asc" } },
        refunds: true,
        payments: { orderBy: { createdAt: "desc" } },
        returns: { orderBy: { createdAt: "desc" } },
      },
    }),
    getSettings(),
  ]);
  if (!order) notFound();
  const delivered = order.status === "DELIVERED" || order.status === "RETURN_REQUESTED";
  const refundTotal = order.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Breadcrumbs items={[{ href: "/account/orders", label: "Orders" }, { label: order.orderNumber }]} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl" data-testid="order-number">{order.orderNumber}</h2>
            <p className="text-sm text-fg-muted">Placed {order.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} · UPI</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <OrderActions orderId={order.id}
        canCancel={isCustomerCancellable(order.status)}
        canReturn={isReturnEligible(order.status, order.deliveredAt, settings.returnWindowDays)}
        canPay={order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED"}
        hasInvoice={Boolean(order.invoiceNumber)} returnWindowDays={settings.returnWindowDays} />

      <section aria-labelledby="track-heading" className="border border-border p-5 md:p-8">
        <h2 id="track-heading" className="mb-6 text-2xl">Tracking</h2>
        {order.trackingNumber && (
          <p className="mb-6 text-sm">
            {order.courierName} · AWB <strong className="font-medium">{order.trackingNumber}</strong>{" "}
            {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-4 hover:decoration-2">Track parcel →</a>}
          </p>
        )}
        <OrderTimeline status={order.status} events={order.events} />
      </section>

      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="mb-4 text-2xl">Items</h2>
          <ul className="divide-y divide-border border-y border-border">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-4 py-4">
                <Link href={`/watches/${it.product.brand.slug}/${it.product.slug}`} className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-surface-2">
                  {it.imageUrl && <WatchImage src={it.imageUrl} alt="" fill sizes="80px" className="object-cover" />}
                </Link>
                <div className="flex-1 text-sm">
                  <p className="small-caps text-xs text-fg-muted">{it.brandName}</p>
                  <p className="font-display text-lg leading-tight">{it.modelName}</p>
                  <p className="text-fg-subtle">Ref. {it.reference} · Qty {it.quantity}</p>
                  <p className="mt-1">{formatINR(it.lineTotal)}</p>
                  {delivered && (it.review ? (
                    <p className="mt-2 text-xs text-fg-muted">Review {it.review.status === "APPROVED" ? "published" : "awaiting moderation"}</p>
                  ) : (
                    <Link href={`/account/reviews/new?product=${it.productId}`} className="mt-2 inline-flex min-h-11 items-center text-xs text-gold underline underline-offset-4 hover:decoration-2" data-testid="write-review">Write a review</Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <div className="flex flex-col gap-8">
          <section aria-labelledby="payment-heading" className="border border-border bg-surface p-5">
            <h2 id="payment-heading" className="mb-4 text-2xl">Payment</h2>
            <PriceBreakdown mrpTotal={order.mrpTotal} itemsTotal={order.itemsTotal} couponDiscount={order.couponDiscount} couponCode={order.couponCode}
              shippingFee={order.shippingFee} total={order.grandTotal} />
            {order.payments.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-fg-muted" data-testid="payment-history">
                {order.payments.map((p) => (
                  <li key={p.id}>UPI · UTR <span className="font-mono text-fg">{p.utr}</span> · {p.status === "SUBMITTED" ? "verification pending" : p.status === "CONFIRMED" ? "verified" : p.status === "REJECTED" ? `not verified${p.rejectReason ? ` — ${p.rejectReason}` : ""}` : p.status.toLowerCase().replace("_", " ")}</li>
                ))}
              </ul>
            )}
            {order.paymentDueAt && (order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED") && (
              <p className="mt-3 text-sm text-warning">Awaiting payment — reserved until {order.paymentDueAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}.</p>
            )}
            {refundTotal > 0 && <p className="mt-3 text-sm text-success">Refunded: {formatINR(refundTotal)}</p>}
          </section>
          <section aria-labelledby="ship-heading">
            <h2 id="ship-heading" className="mb-3 text-2xl">Delivering to</h2>
            <address className="text-sm not-italic text-fg-muted">
              <span className="text-fg">{order.shipName}</span><br />
              {order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}{order.shipLandmark ? `, near ${order.shipLandmark}` : ""}<br />
              {order.shipCity}, {stateName(order.shipState)} {order.shipPincode}<br />+91 {order.shipPhone}
            </address>
          </section>
          {order.returns.length > 0 && (
            <section aria-labelledby="returns-heading">
              <h2 id="returns-heading" className="mb-3 text-2xl">Return requests</h2>
              <ul className="text-sm text-fg-muted">
                {order.returns.map((r) => <li key={r.id}>{r.type === "EXCHANGE" ? "Exchange" : "Return"} · {r.reason} · <span className="text-fg">{r.status.toLowerCase().replace("_", " ")}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

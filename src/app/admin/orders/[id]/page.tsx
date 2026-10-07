import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/admin-shell";
import { OrderTimeline } from "@/components/account/order-timeline";
import { StatusBadge } from "@/components/account/status-badge";
import { PriceBreakdown } from "@/components/bag/order-summary";
import { db } from "@/lib/db";
import { stateName } from "@/lib/india";
import { formatINR } from "@/lib/money";
import { TRANSITIONS } from "@/lib/orders/transitions";
import { requireAdmin } from "@/lib/session";
import { PaymentReview } from "../../payments/payment-review";
import { OrderControls } from "./order-controls";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true, phone: true, id: true } },
      items: true, events: { orderBy: { createdAt: "asc" } }, payments: true, refunds: { orderBy: { createdAt: "desc" } }, returns: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!o) notFound();
  const refunded = o.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amount, 0);
  const received = o.payments.some((p) => ["CONFIRMED", "PARTIALLY_REFUNDED"].includes(p.status));
  const refundable = received ? o.grandTotal - refunded : 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={o.orderNumber} description={`${o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} · UPI · ${o.deliveryOption.toLowerCase()} delivery`}
        actions={<>
          <StatusBadge status={o.status} />
          {o.invoiceNumber && <a className="inline-flex h-10 items-center border border-border px-4 text-xs uppercase tracking-[0.12em] hover:border-gold" href={`/api/orders/${o.id}/invoice`} target="_blank" rel="noopener">Invoice</a>}
          <a className="inline-flex h-10 items-center border border-border px-4 text-xs uppercase tracking-[0.12em] hover:border-gold" href={`/api/orders/${o.id}/invoice?type=packing`} target="_blank" rel="noopener">Packing slip</a>
        </>} />

      {(
        <section className="border border-gold/40 p-4 md:p-6" aria-labelledby="upi-h">
          <h2 id="upi-h" className="mb-3 text-xl">UPI payment</h2>
          {o.payments.length === 0 ? (
            <p className="text-sm text-fg-muted">{o.status === "PENDING_PAYMENT" ? `No UTR submitted yet. Reserved until ${o.paymentDueAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}.` : "No UPI payment recorded."}</p>
          ) : (
            <ul className="divide-y divide-border">
              {o.payments.map((p) => (
                <li key={p.id} className="py-3 text-sm">
                  <p><span className="font-mono text-base">{p.utr}</span> · {formatINR(p.amountPaise / 100)} · <strong>{p.status.toLowerCase().replace("_", " ")}</strong>{p.payerVpa ? ` · from ${p.payerVpa}` : ""}{p.rejectReason ? ` · ${p.rejectReason}` : ""}</p>
                  <p className="text-xs text-fg-muted">Submitted {p.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{p.screenshotUrl ? <> · <a className="text-gold underline" href={p.screenshotUrl} target="_blank" rel="noopener">screenshot</a></> : null}</p>
                  {p.status === "SUBMITTED" && <PaymentReview paymentId={p.id} utr={p.utr} amountLabel={formatINR(p.amountPaise / 100)} cancelled={o.status === "CANCELLED"} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <OrderControls orderId={o.id} status={o.status} next={TRANSITIONS[o.status].filter((x) => !["PAID", "PAYMENT_SUBMITTED", "PAYMENT_FAILED"].includes(x))} refundable={refundable}
        tracking={{ courierName: o.courierName ?? "", trackingNumber: o.trackingNumber ?? "", trackingUrl: o.trackingUrl ?? "" }}
        returns={o.returns.map((r) => ({ id: r.id, type: r.type, reason: r.reason, details: r.details, status: r.status }))} />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-8">
          <section className="border border-border">
            <h2 className="border-b border-border p-4 text-xl">Items</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {o.items.map((it) => (
                  <tr key={it.id}>
                    <td className="p-4"><span className="font-medium">{it.brandName} {it.modelName}</span><span className="block text-xs text-fg-muted">Ref. {it.reference} · SKU {it.sku} · HSN {it.hsnCode}</span></td>
                    <td className="p-4 text-right">× {it.quantity}</td>
                    <td className="p-4 text-right">{formatINR(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="border border-border p-4 md:p-6">
            <h2 className="mb-5 text-xl">Timeline</h2>
            <OrderTimeline status={o.status} events={o.events} />
          </section>
        </div>
        <div className="flex flex-col gap-6">
          <section className="border border-border p-4">
            <h2 className="mb-3 text-xl">Customer</h2>
            <p className="text-sm">{o.user.name ?? "—"}<br /><a className="text-gold" href={`mailto:${o.user.email}`}>{o.user.email}</a></p>
            <h3 className="eyebrow mb-1 mt-4 text-fg-muted">Ship to</h3>
            <address className="text-sm not-italic">{o.shipName}<br />{o.shipLine1}{o.shipLine2 ? `, ${o.shipLine2}` : ""}{o.shipLandmark ? `, near ${o.shipLandmark}` : ""}<br />{o.shipCity}, {stateName(o.shipState)} {o.shipPincode}<br />+91 {o.shipPhone}</address>
          </section>
          <section className="border border-border p-4">
            <h2 className="mb-3 text-xl">Payment</h2>
            <PriceBreakdown mrpTotal={o.mrpTotal} itemsTotal={o.itemsTotal} couponDiscount={o.couponDiscount} couponCode={o.couponCode} shippingFee={o.shippingFee} total={o.grandTotal} />
            <p className="mt-3 text-xs text-fg-muted">Taxable {formatINR(o.taxableValue)} · {o.igst ? `IGST ${formatINR(o.igst)}` : `CGST ${formatINR(o.cgst)} + SGST ${formatINR(o.sgst)}`}</p>
            <ul className="mt-3 space-y-1 text-xs text-fg-muted">
              {o.refunds.map((r) => <li key={r.id} className={r.status === "PENDING" ? "text-warning" : "text-success"}>Refund {formatINR(r.amount)} · {r.status === "PENDING" ? "to send" : `sent · ref ${r.reference}`} · {r.reason}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

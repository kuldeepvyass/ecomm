import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { expireUnpaidOrders } from "@/server/orders/service";
import { readSettings } from "@/server/settings";
import { PaymentReview, RefundSent } from "./payment-review";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Payments({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  await expireUnpaidOrders();
  const sp = await searchParams;
  const tab = sp.tab === "refunds" ? "refunds" : sp.tab === "reviewed" ? "reviewed" : sp.tab === "awaiting" ? "awaiting" : "verify";
  const [settings, toVerify, refunds, reviewed, awaiting, counts] = await Promise.all([
    readSettings(),
    db.payment.findMany({ where: { status: "SUBMITTED" }, orderBy: { createdAt: "asc" }, include: { order: { include: { user: { select: { email: true } } } } } }),
    db.refund.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { order: { include: { user: { select: { email: true } }, payments: { where: { status: { in: ["CONFIRMED", "SUBMITTED", "REFUNDED", "PARTIALLY_REFUNDED"] } } } } } } }),
    db.payment.findMany({ where: { status: { not: "SUBMITTED" } }, orderBy: { reviewedAt: "desc" }, take: 40, include: { order: true, reviewedBy: { select: { email: true } } } }),
    db.order.findMany({ where: { status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] } }, orderBy: { createdAt: "desc" }, include: { user: { select: { email: true } } } }),
    Promise.all([db.payment.count({ where: { status: "SUBMITTED" } }), db.refund.count({ where: { status: "PENDING" } })]),
  ]);
  const tabs = [
    ["verify", `To verify (${counts[0]})`],
    ["refunds", `Refunds to send (${counts[1]})`],
    ["awaiting", `Awaiting payment (${awaiting.length})`],
    ["reviewed", "Reviewed"],
  ] as const;

  return (
    <div>
      <PageHeader title="Payments" description={`Direct UPI to ${settings.upiVpa ?? "— set your UPI ID in Settings —"}. Check each UTR and amount in your bank / UPI business app before confirming.`} />
      {!settings.upiVpa && (
        <p className="mb-6 border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
          Your store UPI ID isn&apos;t set. Customers can&apos;t pay by UPI in production until you add it in <Link href="/admin/settings" className="underline">Settings</Link>.
        </p>
      )}
      <div className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 no-scrollbar">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/payments?tab=${k}`} className={cn("min-h-10 whitespace-nowrap rounded-full border px-4 text-xs uppercase leading-10 tracking-[0.12em]", tab === k ? "border-gold text-gold" : "border-border text-fg-muted")}>{label}</Link>
        ))}
      </div>

      {tab === "verify" && (
        toVerify.length === 0 ? <p className="border border-border p-10 text-center text-fg-muted">Nothing to verify. New UTRs appear here (and you get an email) as customers submit them.</p> : (
          <ul className="grid gap-4 xl:grid-cols-2" data-testid="payments-to-verify">
            {toVerify.map((p) => (
              <li key={p.id} className="border border-border bg-surface p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/orders/${p.orderId}`} className="font-medium hover:text-gold">{p.order.orderNumber}</Link>
                    <p className="text-xs text-fg-muted">{p.order.shipName} · {p.order.user.email} · +91 {p.order.shipPhone}</p>
                  </div>
                  <p className="font-display text-3xl tabular-nums">{formatINR(p.amountPaise / 100)}</p>
                </div>
                <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
                  <dt className="text-fg-muted">UTR</dt><dd className="font-mono text-base" data-testid="review-utr">{p.utr}</dd>
                  <dt className="text-fg-muted">Payer UPI ID</dt><dd>{p.payerVpa ?? "—"}</dd>
                  <dt className="text-fg-muted">Note to match</dt><dd>Order {p.order.orderNumber}</dd>
                  <dt className="text-fg-muted">Submitted</dt><dd>{fmt(p.createdAt)}</dd>
                  <dt className="text-fg-muted">Screenshot</dt><dd>{p.screenshotUrl ? <a href={p.screenshotUrl} target="_blank" rel="noopener" className="text-gold underline">View</a> : "—"}</dd>
                </dl>
                <PaymentReview paymentId={p.id} utr={p.utr} amountLabel={formatINR(p.amountPaise / 100)} cancelled={p.order.status === "CANCELLED"} />
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "refunds" && (
        refunds.length === 0 ? <p className="border border-border p-10 text-center text-fg-muted">No refunds waiting.</p> : (
          <ul className="flex flex-col gap-3">
            {refunds.map((r) => (
              <li key={r.id} className="border border-border p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <Link href={`/admin/orders/${r.orderId}`} className="font-medium hover:text-gold">{r.order.orderNumber}</Link>
                    <p className="text-xs text-fg-muted">{r.order.shipName} · {r.order.user.email}</p>
                    <p className="mt-1 text-sm">{r.reason}</p>
                    <p className="mt-1 text-xs text-fg-muted">Send to: {r.order.payments.map((p) => p.payerVpa).filter(Boolean)[0] ?? "the UPI account that paid (see UTR " + (r.order.payments[0]?.utr ?? "—") + ")"}</p>
                  </div>
                  <p className="font-display text-2xl">{formatINR(r.amount)}</p>
                </div>
                <RefundSent refundId={r.id} />
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "awaiting" && (
        <ul className="divide-y divide-border border-y border-border text-sm">
          {awaiting.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-gold">{o.orderNumber}</Link>
              <span className="text-fg-muted">{o.shipName} · {o.user.email}</span>
              <span>{formatINR(o.grandTotal)}</span>
              <Badge tone={o.status === "PAYMENT_FAILED" ? "danger" : "outline"}>{o.status === "PAYMENT_FAILED" ? "UTR rejected" : "No UTR yet"}</Badge>
              <span className="text-xs text-fg-muted">releases {o.paymentDueAt ? fmt(o.paymentDueAt) : "—"}</span>
            </li>
          ))}
          {awaiting.length === 0 && <li className="py-6 text-center text-fg-muted">No unpaid orders.</li>}
        </ul>
      )}

      {tab === "reviewed" && (
        <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted"><tr><th className="p-3">Order</th><th className="p-3">UTR</th><th className="p-3 text-right">Amount</th><th className="p-3">Result</th><th className="p-3">By</th><th className="p-3">When</th></tr></thead>
            <tbody className="divide-y divide-border">
              {reviewed.map((p) => (
                <tr key={p.id}>
                  <td className="p-3"><Link href={`/admin/orders/${p.orderId}`} className="hover:text-gold">{p.order.orderNumber}</Link></td>
                  <td className="p-3 font-mono">{p.utr}</td>
                  <td className="p-3 text-right">{formatINR(p.amountPaise / 100)}</td>
                  <td className="p-3"><Badge tone={p.status === "CONFIRMED" ? "success" : p.status === "REJECTED" ? "danger" : "outline"}>{p.status.toLowerCase().replace("_", " ")}</Badge>{p.rejectReason && <span className="block text-xs text-fg-muted">{p.rejectReason}</span>}</td>
                  <td className="p-3 text-fg-muted">{p.reviewedBy?.email ?? "—"}</td>
                  <td className="p-3 text-fg-muted">{p.reviewedAt ? fmt(p.reviewedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

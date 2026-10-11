"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders/transitions";
import { decideReturn, refundOrder, saveTracking, updateOrderStatus } from "@/server/actions/admin/orders";

const COURIERS = ["Blue Dart", "Delhivery", "DTDC", "Ecom Express", "India Post (Speed Post)", "Shiprocket", "Xpressbees", "Other"];

export function OrderControls({ orderId, orderNumber, status, next, refundable, canCancel, paidTotal, tracking, returns }: {
  orderId: string; orderNumber: string; status: OrderStatus; next: OrderStatus[]; refundable: number;
  /** Cancel lives in its own box (not the status dropdown) so it's never selected by default. */
  canCancel: boolean; paidTotal: number;
  tracking: { courierName: string; trackingNumber: string; trackingUrl: string };
  returns: { id: string; type: string; reason: string; details: string | null; status: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [to, setTo] = useState<OrderStatus | "">(next[0] ?? "");
  const [note, setNote] = useState("");
  const [t, setT] = useState(tracking);
  const [refundAmt, setRefundAmt] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(r.message ?? "Done"); router.refresh(); } else toast.error(r.error); });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section className="border border-gold/40 bg-surface p-4" aria-labelledby="status-h">
        <h2 id="status-h" className="mb-3 text-xl">Update status</h2>
        {next.length === 0 ? <p className="text-sm text-fg-muted">{status === "PENDING_PAYMENT" || status === "PAYMENT_SUBMITTED" || status === "PAYMENT_FAILED" ? "Waiting for the UPI payment — confirm it in the payment panel." : "This order is closed."}</p> : (
          <div className="flex flex-col gap-3">
            <Field label="Move to">{(p) => (
              <Select {...p} value={to} onChange={(e) => setTo(e.target.value as OrderStatus)} data-testid="admin-next-status">
                {next.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
            )}</Field>
            {(to === "SHIPPED" || to === "OUT_FOR_DELIVERY") && (
              <>
                <Field label="Courier">{(p) => <Select {...p} value={t.courierName} onChange={(e) => setT({ ...t, courierName: e.target.value })}><option value="">Choose</option>{COURIERS.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
                <Field label="Tracking / AWB number">{(p) => <Input {...p} value={t.trackingNumber} onChange={(e) => setT({ ...t, trackingNumber: e.target.value })} data-testid="admin-awb" />}</Field>
                <Field label="Tracking link">{(p) => <Input {...p} type="url" value={t.trackingUrl} onChange={(e) => setT({ ...t, trackingUrl: e.target.value })} placeholder="https://" />}</Field>
              </>
            )}
            <Field label="Note to customer (optional)">{(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <Button loading={pending} disabled={!to} data-testid="admin-update-status"
              onClick={() => act(() => updateOrderStatus({ orderId, to: to as OrderStatus, note: note || undefined, ...(to === "SHIPPED" || to === "OUT_FOR_DELIVERY" ? t : {}) }))}>
              Update status
            </Button>
          </div>
        )}
      </section>

      {canCancel && (
        <section className="border border-danger/40 p-4" aria-labelledby="cancel-h">
          <h2 id="cancel-h" className="mb-1 text-xl">Cancel order</h2>
          <p className="mb-3 text-sm text-fg-muted">
            The watch goes back into stock and the customer is emailed.
            {paidTotal > 0 ? ` A ${formatINR(paidTotal)} refund is logged; the customer is asked for bank details, then it appears in Payments → Refunds to send.` : status === "PAYMENT_SUBMITTED" ? " Their UTR is still unverified — confirm or reject it first if you can." : " Nothing has been paid."}
          </p>
          <Field label="Reason (shown to the customer)" required>
            {(p) => <Input {...p} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Out of stock at the supplier" data-testid="admin-cancel-reason" />}
          </Field>
          <Button variant="danger" className="mt-3" loading={pending} disabled={cancelReason.trim().length < 3} data-testid="admin-cancel-order"
            onClick={() => {
              if (!confirm(`Cancel ${orderNumber}?${paidTotal > 0 ? ` A refund of ${formatINR(paidTotal)} will be logged.` : ""}`)) return;
              act(() => updateOrderStatus({ orderId, to: "CANCELLED", note: `Cancelled by store: ${cancelReason.trim()}` }));
            }}>Cancel order</Button>
        </section>
      )}

      <section className="border border-border p-4" aria-labelledby="track-h">
        <h2 id="track-h" className="mb-3 text-xl">Courier & tracking</h2>
        <div className="flex flex-col gap-3">
          <Field label="Courier">{(p) => <Select {...p} value={t.courierName} onChange={(e) => setT({ ...t, courierName: e.target.value })}><option value="">Choose</option>{COURIERS.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          <Field label="AWB number">{(p) => <Input {...p} value={t.trackingNumber} onChange={(e) => setT({ ...t, trackingNumber: e.target.value })} />}</Field>
          <Field label="Tracking link">{(p) => <Input {...p} type="url" value={t.trackingUrl} onChange={(e) => setT({ ...t, trackingUrl: e.target.value })} placeholder="https://" />}</Field>
          <Button variant="outline" loading={pending} onClick={() => act(() => saveTracking({ orderId, ...t }))}>Save tracking</Button>
        </div>
      </section>

      <section className="border border-border p-4" aria-labelledby="refund-h">
        <h2 id="refund-h" className="mb-3 text-xl">Refund</h2>
        {refundable <= 0 ? <p className="text-sm text-fg-muted">Nothing refundable{status === "PENDING_PAYMENT" ? " — not yet paid" : ""}.</p> : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Up to <strong>{formatINR(refundable)}</strong> can be refunded. Send it by UPI/bank transfer, then record the reference here{status === "RETURNED" || status === "CANCELLED" ? "" : " (partial refunds keep the order status)"}.</p>
            <Field label="Amount (blank = full remaining)">{(p) => <Input {...p} inputMode="numeric" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value.replace(/\D/g, ""))} />}</Field>
            <Field label="Reason">{(p) => <Input {...p} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />}</Field>
            <Field label="Transfer reference / UTR (blank = log as pending)">{(p) => <Input {...p} value={refundRef} onChange={(e) => setRefundRef(e.target.value)} />}</Field>
            <Button variant="danger" loading={pending} disabled={refundReason.trim().length < 3} onClick={() => {
              if (!confirm(`Record a refund of ${refundAmt ? formatINR(Number(refundAmt)) : formatINR(refundable)}?`)) return;
              act(() => refundOrder({ orderId, amount: refundAmt ? Number(refundAmt) : null, reason: refundReason, reference: refundRef }));
            }}>Record refund</Button>
          </div>
        )}
      </section>

      {returns.length > 0 && (
        <section className="border border-warning/40 p-4 md:col-span-2 xl:col-span-3">
          <h2 className="mb-3 text-xl">Return / exchange requests</h2>
          <ul className="divide-y divide-border">
            {returns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span><Badge tone="outline">{r.type.toLowerCase()}</Badge> {r.reason}{r.details ? ` — ${r.details}` : ""} · <strong>{r.status.toLowerCase().replace("_", " ")}</strong></span>
                <span className="flex gap-2">
                  {r.status === "REQUESTED" && <>
                    <Button size="sm" onClick={() => act(() => decideReturn({ returnId: r.id, decision: "APPROVED" }))}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => act(() => decideReturn({ returnId: r.id, decision: "REJECTED" }))}>Decline</Button>
                  </>}
                  {r.status === "APPROVED" && <Button size="sm" variant="outline" onClick={() => act(() => decideReturn({ returnId: r.id, decision: "PICKED_UP" }))}>Mark picked up</Button>}
                  {(r.status === "APPROVED" || r.status === "PICKED_UP") && <Button size="sm" onClick={() => act(() => decideReturn({ returnId: r.id, decision: "COMPLETED" }))}>Received → Returned</Button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

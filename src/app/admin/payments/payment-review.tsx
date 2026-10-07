"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { confirmPayment, markRefundSent, rejectPayment } from "@/server/actions/admin/orders";

const REASONS = ["No payment with this UTR in our account", "Amount doesn't match the order total", "Paid to a different UPI ID", "UTR belongs to another order", "Other"];

export function PaymentReview({ paymentId, utr, amountLabel, cancelled }: { paymentId: string; utr: string; amountLabel: string; cancelled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [other, setOther] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(r.message ?? "Done"); router.refresh(); } else toast.error(r.error); });

  if (cancelled) return <p className="mt-4 text-sm text-warning">The customer cancelled this order. If {amountLabel} arrived with UTR {utr}, refund it from the Refunds tab.</p>;
  return (
    <div className="mt-5 flex flex-col gap-3">
      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <Button loading={pending} data-testid="confirm-payment" onClick={() => {
            if (!confirm(`Confirm that ${amountLabel} with UTR ${utr} has arrived in your account?`)) return;
            run(() => confirmPayment(paymentId));
          }}>Confirm payment received</Button>
          <Button variant="outline" onClick={() => setRejecting(true)}>Reject</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border border-danger/40 p-3">
          <label className="text-xs text-fg-muted" htmlFor={`r-${paymentId}`}>Reason (shown to the customer)</label>
          <Select id={`r-${paymentId}`} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
          {reason === "Other" && <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Explain briefly" aria-label="Other reason" />}
          <div className="flex gap-2">
            <Button variant="danger" size="sm" loading={pending} onClick={() => run(() => rejectPayment(paymentId, reason === "Other" ? other : reason))}>Reject &amp; ask to resubmit</Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RefundSent({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await markRefundSent(refundId, ref);
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
    }); }}>
      <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / reference of your refund transfer" aria-label="Refund reference" className="h-10 max-w-xs" />
      <Button type="submit" size="sm" className="h-10" loading={pending} disabled={ref.trim().length < 6}>Mark refund sent</Button>
    </form>
  );
}

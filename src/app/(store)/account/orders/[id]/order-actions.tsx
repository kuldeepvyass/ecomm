"use client";

import { Download, RotateCcw, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useStore } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cancelMyOrder, reorder, requestReturn } from "@/server/actions/account";

const RETURN_REASONS = ["Doesn't fit my wrist", "Not as expected", "Arrived damaged", "Received the wrong item", "Changed my mind", "Other"];

export function OrderActions({ orderId, canCancel, canReturn, canPay, hasInvoice, returnWindowDays }: {
  orderId: string; canCancel: boolean; canReturn: boolean; canPay: boolean; hasInvoice: boolean; returnWindowDays: number;
}) {
  const router = useRouter();
  const { refresh } = useStore();
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [details, setDetails] = useState("");

  return (
    <div className="flex flex-wrap gap-3">
      {canPay && <Button asChild data-testid="retry-payment"><Link href={`/checkout/pay/${orderId}`}>Complete UPI payment</Link></Button>}
      {hasInvoice && (
        <Button asChild variant="outline"><a href={`/api/orders/${orderId}/invoice`} target="_blank" rel="noopener"><Download aria-hidden /> GST invoice</a></Button>
      )}
      <Button variant="outline" loading={pending} onClick={() => start(async () => {
        const res = await reorder(orderId);
        if (!res.ok) return void toast.error(res.error);
        await refresh();
        if (res.data.skipped.length) toast.message(`Some items couldn't be added: ${res.data.skipped.join(", ")}`);
        if (res.data.added) { toast.success("Added to your bag"); router.push("/bag"); }
      })}><ShoppingBag aria-hidden /> Buy again</Button>

      {canCancel && (
        <Sheet open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel order" description="Cancel any time before your order ships."
          trigger={<Button variant="ghost" className="text-danger" data-testid="cancel-order"><X aria-hidden /> Cancel order</Button>}
          footer={<Button variant="danger" block loading={pending} disabled={!reason} onClick={() => start(async () => {
            const res = await cancelMyOrder(orderId, reason);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Order cancelled. If you already paid, we'll refund it to your UPI account.");
            setCancelOpen(false);
            router.refresh();
          })}>Confirm cancellation</Button>}>
          <Field label="Reason" required>
            {(p) => (
              <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="" disabled>Choose a reason</option>
                {["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change the model", "Other"].map((r) => <option key={r}>{r}</option>)}
              </Select>
            )}
          </Field>
        </Sheet>
      )}

      {canReturn && (
        <Sheet open={returnOpen} onOpenChange={setReturnOpen} title="Return or exchange" description={`Within ${returnWindowDays} days of delivery, unworn with all tags, box and papers.`}
          trigger={<Button variant="ghost" data-testid="request-return"><RotateCcw aria-hidden /> Return / exchange</Button>}
          footer={<Button block loading={pending} disabled={!reason} onClick={() => start(async () => {
            const res = await requestReturn({ orderId, type, reason, details: details || undefined });
            if (!res.ok) return void toast.error(res.error);
            toast.success("Request received — we'll contact you within one business day.");
            setReturnOpen(false);
            router.refresh();
          })}>Submit request</Button>}>
          <div className="flex flex-col gap-4">
            <fieldset className="flex gap-2">
              <legend className="eyebrow mb-2 text-fg-muted">I&apos;d like a</legend>
              {(["RETURN", "EXCHANGE"] as const).map((t) => (
                <label key={t} className="flex min-h-11 flex-1 items-center justify-center gap-2 border border-border text-sm has-[:checked]:border-gold has-[:checked]:text-gold">
                  <input type="radio" name="rtype" className="sr-only" checked={type === t} onChange={() => setType(t)} />
                  {t === "RETURN" ? "Refund" : "Exchange"}
                </label>
              ))}
            </fieldset>
            <Field label="Reason" required>
              {(p) => (
                <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="" disabled>Choose a reason</option>
                  {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Details (optional)">{(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />}</Field>
          </div>
        </Sheet>
      )}

    </div>
  );
}

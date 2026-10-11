"use client";

import { CheckCircle2, Clock, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BankDetailsFields, EMPTY_BANK, readBank, type BankDraft } from "@/components/account/bank-details-fields";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { maskAccount } from "@/lib/validation/bank";
import { saveRefundBankDetails } from "@/server/actions/account";

/** What the customer may see about a refund — never the full account number. */
export type RefundView = {
  id: string; amount: number; status: "PENDING" | "PROCESSED" | "FAILED"; reference: string | null;
  accountLast4: string | null; bankName: string | null; hasBank: boolean; processedAt: string | null; awaitingVerification: boolean;
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function RefundPanel({ orderId, refunds }: { orderId: string; refunds: RefundView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [bank, setBank] = useState<BankDraft>(EMPTY_BANK);
  const open = refunds.filter((r) => r.status === "PENDING");
  const missing = open.some((r) => !r.hasBank);
  const showForm = missing || editing;
  const value = readBank(bank).value;

  return (
    <section aria-labelledby="refund-heading" className="flex flex-col gap-3" data-testid="refund-panel">
      <h2 id="refund-heading" className="text-2xl">Refund</h2>
      {refunds.map((r) => r.status === "PROCESSED" ? (
        <div key={r.id} className="flex gap-3 border border-success/40 bg-success/10 p-4 text-sm" data-testid="refund-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-medium">Refund successful — {formatINR(r.amount)}</p>
            <p className="mt-1 text-fg-muted">
              Sent {r.accountLast4 ? <>to A/c <span className="font-mono">{maskAccount(r.accountLast4)}</span>{r.bankName ? ` · ${r.bankName}` : ""}</> : "to your account"}
              {r.processedAt ? ` on ${date(r.processedAt)}` : ""}.{r.reference && <> Reference <span className="font-mono text-fg">{r.reference}</span>.</>}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">Bank transfers can take up to 2 business days to show in your statement.</p>
          </div>
        </div>
      ) : r.status === "PENDING" && r.hasBank ? (
        <div key={r.id} className="flex gap-3 border border-border bg-surface p-4 text-sm" data-testid="refund-pending">
          <Clock className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Refund of {formatINR(r.amount)} is being processed</p>
            <p className="mt-1 text-fg-muted">
              {r.awaitingVerification ? "Once your payment is verified, we'll" : "We'll"} transfer it to A/c <span className="font-mono">{maskAccount(r.accountLast4)}</span>{r.bankName ? ` · ${r.bankName}` : ""}, usually within 2–3 business days. We&apos;ll email you when it&apos;s sent.
            </p>
            {!editing && <button type="button" onClick={() => setEditing(true)} className="mt-2 min-h-11 text-xs text-gold underline underline-offset-4">Change bank details</button>}
          </div>
        </div>
      ) : r.status === "PENDING" ? (
        <div key={r.id} className="flex gap-3 border border-warning/50 bg-warning/10 p-4 text-sm" data-testid="refund-needs-bank">
          <Landmark className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p><span className="font-medium">Add your bank details to receive your {formatINR(r.amount)} refund.</span> <span className="text-fg-muted">We send refunds by bank transfer as soon as we have them.</span></p>
        </div>
      ) : null)}

      {open.length > 0 && showForm && (
        <div className="border border-border p-4 md:p-5">
          <BankDetailsFields value={bank} onChange={setBank} />
          <div className="mt-5 flex gap-3">
            <Button loading={pending} disabled={!value} data-testid="save-bank" onClick={() => start(async () => {
              const res = await saveRefundBankDetails(orderId, value);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Bank details saved — we'll send your refund there.");
              setEditing(false);
              setBank(EMPTY_BANK);
              router.refresh();
            })}>Save bank details</Button>
            {editing && !missing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </div>
      )}
    </section>
  );
}

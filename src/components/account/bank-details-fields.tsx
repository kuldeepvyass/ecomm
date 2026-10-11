"use client";

import { Landmark } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Field, Input } from "@/components/ui/field";
import { IFSC_REGEX, bankDetailsSchema, type BankDetails } from "@/lib/validation/bank";
import { lookupIfsc } from "@/server/actions/account";

export type BankDraft = { accountHolder: string; accountNumber: string; confirmNumber: string; ifsc: string; bankName: string; bankBranch: string };
export const EMPTY_BANK: BankDraft = { accountHolder: "", accountNumber: "", confirmNumber: "", ifsc: "", bankName: "", bankBranch: "" };

/** Valid details ready to send, or null (with per-field messages for anything touched). */
export function readBank(d: BankDraft): { value: BankDetails | null; errors: Partial<Record<keyof BankDraft, string>> } {
  const errors: Partial<Record<keyof BankDraft, string>> = {};
  const parsed = bankDetailsSchema.safeParse(d);
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path[0] as keyof BankDraft] ??= i.message;
  if (d.confirmNumber && d.confirmNumber.replace(/[\s-]/g, "") !== d.accountNumber.replace(/[\s-]/g, "")) errors.confirmNumber = "Account numbers don't match";
  if (!d.confirmNumber) errors.confirmNumber = "Re-enter the account number";
  return { value: Object.keys(errors).length ? null : parsed.data!, errors };
}

/**
 * Refunds go to a bank account (UPI transfers cap at ~₹1 lakh a day). Typing a valid IFSC fills in the
 * bank and branch. Errors show only after a field is left, so the form doesn't shout while typing.
 */
/** `onChange` is a state setter: updates merge into the latest draft, so a slow IFSC lookup never overwrites newer typing. */
export function BankDetailsFields({ value, onChange }: { value: BankDraft; onChange: Dispatch<SetStateAction<BankDraft>> }) {
  const [touched, setTouched] = useState<Partial<Record<keyof BankDraft, boolean>>>({});
  const [looking, setLooking] = useState(false);
  const { errors } = readBank(value);
  const set = (k: keyof BankDraft, v: string) => onChange((d) => ({ ...d, [k]: v }));
  const err = (k: keyof BankDraft) => (touched[k] ? errors[k] : undefined);
  const blur = (k: keyof BankDraft) => () => setTouched((t) => ({ ...t, [k]: true }));
  const digits = (v: string) => v.replace(/[^\d]/g, "").slice(0, 18);

  async function onIfsc(raw: string) {
    const ifsc = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    onChange((d) => ({ ...d, ifsc }));
    if (!IFSC_REGEX.test(ifsc)) return;
    setLooking(true);
    const hit = await lookupIfsc(ifsc).catch(() => null);
    setLooking(false);
    // Only apply if the IFSC hasn't changed meanwhile.
    if (hit) onChange((d) => (d.ifsc === ifsc ? { ...d, bankName: hit.bank, bankBranch: hit.branch } : d));
  }

  return (
    <fieldset className="flex flex-col gap-4" data-testid="bank-details">
      <legend className="mb-1 flex items-center gap-2 text-sm font-medium"><Landmark className="size-4 text-gold" aria-hidden /> Refund to bank account</legend>
      <p className="-mt-2 text-xs text-fg-muted">We transfer refunds by bank (IMPS/NEFT), so amounts above UPI&apos;s daily limit arrive in one go. Only our team sees these details; we keep just the last 4 digits once the refund is sent.</p>
      <Field label="Account holder name" required error={err("accountHolder")}>
        {(p) => <Input {...p} autoComplete="name" value={value.accountHolder} onBlur={blur("accountHolder")} onChange={(e) => set("accountHolder", e.target.value)} />}
      </Field>
      <Field label="Account number" required error={err("accountNumber")}>
        {(p) => <Input {...p} inputMode="numeric" autoComplete="off" value={value.accountNumber} onBlur={blur("accountNumber")} onChange={(e) => set("accountNumber", digits(e.target.value))} />}
      </Field>
      <Field label="Re-enter account number" required error={err("confirmNumber")}>
        {(p) => <Input {...p} inputMode="numeric" autoComplete="off" value={value.confirmNumber} onBlur={blur("confirmNumber")} onPaste={(e) => e.preventDefault()} onChange={(e) => set("confirmNumber", digits(e.target.value))} />}
      </Field>
      <Field label="IFSC" required error={err("ifsc")} hint={looking ? "Finding your bank…" : value.bankBranch ? value.bankBranch : "11 characters, on your cheque book or passbook"}>
        {(p) => <Input {...p} autoCapitalize="characters" autoComplete="off" value={value.ifsc} onBlur={blur("ifsc")} onChange={(e) => void onIfsc(e.target.value)} className="uppercase tracking-[0.08em]" />}
      </Field>
      <Field label="Bank name" required error={err("bankName")}>
        {(p) => <Input {...p} value={value.bankName} onBlur={blur("bankName")} onChange={(e) => set("bankName", e.target.value)} />}
      </Field>
    </fieldset>
  );
}

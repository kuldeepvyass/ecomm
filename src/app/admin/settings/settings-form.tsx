"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { INDIAN_STATES } from "@/lib/india";
import { deleteAllSampleData, saveSettings } from "@/server/actions/admin/store";
import type { StoreConfig } from "@/server/settings";

const S = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function SettingsForm({ initial, demo }: { initial: StoreConfig; demo: { products: number; reviews: number } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const set = (k: keyof StoreConfig, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  const t = (k: keyof StoreConfig, label: string, hint?: string, inputMode?: "numeric") => (
    <Field label={label} error={errors[k]} hint={hint}>{(p) => <Input {...p} inputMode={inputMode} value={S(v[k])} onChange={(e) => set(k, e.target.value)} />}</Field>
  );

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await saveSettings(v as never);
        if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
        setErrors({}); toast.success(r.message); router.refresh();
      }); }} className="flex flex-col gap-8" noValidate>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="text-2xl sm:col-span-2 lg:col-span-3">Business</h2>
          {t("storeName", "Store name")}
          {t("contactEmail", "Contact email")}
          {t("contactPhone", "Contact phone")}
          {t("whatsappNumber", "WhatsApp number", "With country code, e.g. 919876543210 — shows the chat button")}
          {t("gstin", "GSTIN", "Leave blank until registered — invoices say 'Bill of Supply'")}
          <Field label="Business state (for GST)" error={errors.stateCode}>{(p) => <Select {...p} value={v.stateCode} onChange={(e) => set("stateCode", e.target.value)}>{INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</Select>}</Field>
          <div className="sm:col-span-2 lg:col-span-3">{t("addressLine", "Registered address")}</div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="text-2xl sm:col-span-2 lg:col-span-3">UPI payments</h2>
          <p className="text-sm text-fg-muted sm:col-span-2 lg:col-span-3">Customers pay this UPI ID directly — no gateway, no fees. Use a business/merchant UPI ID (e.g. from your bank, PhonePe Business, Paytm Business or BharatPe) so payments show the order note and you get instant notifications to verify UTRs.</p>
          {t("upiVpa", "Store UPI ID", "e.g. maisonhorlogere@okhdfcbank — UPI checkout is off until this is set")}
          {t("upiPayeeName", "Payee name shown in UPI apps", "Defaults to the store name")}
          {t("paymentWindowMinutes", "Hold stock for unpaid orders (minutes)", "After this, unpaid orders are cancelled and the watch is released", "numeric")}
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="text-2xl sm:col-span-2 lg:col-span-3">Shipping & returns</h2>
          {t("shippingFee", "Standard shipping fee ₹", undefined, "numeric")}
          {t("freeShippingThreshold", "Free shipping above ₹", "Blank = never free", "numeric")}
          {t("expressShippingFee", "Express shipping fee ₹", "Blank = express not offered", "numeric")}
          {t("defaultDeliveryDays", "Default delivery days", undefined, "numeric")}
          {t("returnWindowDays", "Return window (days after delivery)", undefined, "numeric")}
        </section>
        <Button type="submit" loading={pending} className="self-start">Save settings</Button>
      </form>

      <section className="border border-danger/40 p-5" aria-labelledby="demo-h">
        <h2 id="demo-h" className="text-2xl">Sample data</h2>
        {demo.products === 0 ? <p className="mt-2 text-sm text-success">No sample data remains — the preview banner is off.</p> : (
          <>
            <p className="mt-2 text-sm text-fg-muted">
              {demo.products} sample products and {demo.reviews} sample reviews (with their images and ratings) are live. Deleting them removes the &quot;Preview mode&quot; banner automatically.
              Sample products that appear in any order are hidden instead of deleted so order history stays intact.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Field label='Type "DELETE SAMPLE DATA"'>{(p) => <Input {...p} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="w-64" />}</Field>
              <Button variant="danger" loading={pending} disabled={confirmText.trim().toUpperCase() !== "DELETE SAMPLE DATA"} data-testid="delete-sample-data"
                onClick={() => start(async () => { const r = await deleteAllSampleData(confirmText); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>
                Delete all sample data
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

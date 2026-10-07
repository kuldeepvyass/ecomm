"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/admin/action-button";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { formatINR } from "@/lib/money";
import { deleteCoupon, saveCoupon } from "@/server/actions/admin/store";

type C = { id: string; code: string; description: string | null; type: "PERCENT" | "FLAT"; value: number; maxDiscount: number | null; minOrderValue: number; startsAt: string | null; expiresAt: string | null; usageLimit: number | null; perUserLimit: number | null; usedCount: number; active: boolean };
const blank = { code: "", description: "", type: "PERCENT" as const, value: "", maxDiscount: "", minOrderValue: "", startsAt: "", expiresAt: "", usageLimit: "", perUserLimit: "1", active: true };
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function CouponsView({ coupons }: { coupons: C[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<(typeof blank & { id?: string }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const set = (k: string, v: unknown) => setEditing((e) => (e ? { ...e, [k]: v } : e));
  const [now] = useState(() => Date.now());

  return (
    <>
      <Button size="sm" onClick={() => { setErrors({}); setEditing({ ...blank }); }}><Plus aria-hidden /> New coupon</Button>
      <div tabIndex={0} role="region" aria-label="Scrollable table" className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted"><tr><th className="p-3">Code</th><th className="p-3">Discount</th><th className="p-3">Min order</th><th className="p-3">Validity</th><th className="p-3">Used</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-border">
            {coupons.map((c) => {
              const expired = c.expiresAt && new Date(c.expiresAt).getTime() < now;
              return (
                <tr key={c.id}>
                  <td className="p-3 font-mono">{c.code}<span className="block font-sans text-xs text-fg-muted">{c.description}</span></td>
                  <td className="p-3">{c.type === "PERCENT" ? `${c.value}%${c.maxDiscount ? ` (max ${formatINR(c.maxDiscount)})` : ""}` : formatINR(c.value)}</td>
                  <td className="p-3">{c.minOrderValue ? formatINR(c.minOrderValue) : "—"}</td>
                  <td className="p-3 text-xs">{c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN") : "Now"} → {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "No expiry"}</td>
                  <td className="p-3">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}{c.perUserLimit ? <span className="block text-xs text-fg-muted">{c.perUserLimit}/customer</span> : null}</td>
                  <td className="p-3">{!c.active ? <Badge tone="outline">Off</Badge> : expired ? <Badge tone="danger">Expired</Badge> : <Badge tone="success">Live</Badge>}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setErrors({}); setEditing({ id: c.id, code: c.code, description: c.description ?? "", type: c.type as "PERCENT", value: String(c.value), maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "", minOrderValue: String(c.minOrderValue || ""), startsAt: toLocal(c.startsAt), expiresAt: toLocal(c.expiresAt), usageLimit: c.usageLimit ? String(c.usageLimit) : "", perUserLimit: c.perUserLimit ? String(c.perUserLimit) : "", active: c.active }); }}>Edit</Button>
                    <ActionButton size="sm" variant="ghost" className="text-danger" confirmText={`Delete ${c.code}?`} action={() => deleteCoupon(c.id)}>Delete</ActionButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? "Edit coupon" : "New coupon"}
        footer={<Button block loading={pending} onClick={() => start(async () => {
          const r = await saveCoupon({ ...editing!, startsAt: editing!.startsAt || null, expiresAt: editing!.expiresAt || null } as never);
          if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
          toast.success(r.message); setEditing(null); router.refresh();
        })}>Save coupon</Button>}>
        {editing && (
          <div className="flex flex-col gap-4">
            <Field label="Code" error={errors.code} required>{(p) => <Input {...p} value={editing.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />}</Field>
            <Field label="Description (shown to customers)" error={errors.description}>{(p) => <Input {...p} value={editing.description} onChange={(e) => set("description", e.target.value)} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">{(p) => <Select {...p} value={editing.type} onChange={(e) => set("type", e.target.value)}><option value="PERCENT">Percent</option><option value="FLAT">Flat ₹</option></Select>}</Field>
              <Field label={editing.type === "PERCENT" ? "Percent" : "Amount ₹"} error={errors.value} required>{(p) => <Input {...p} inputMode="decimal" value={editing.value} onChange={(e) => set("value", e.target.value)} />}</Field>
            </div>
            {editing.type === "PERCENT" && <Field label="Max discount ₹ (optional)" error={errors.maxDiscount}>{(p) => <Input {...p} inputMode="numeric" value={editing.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} />}</Field>}
            <Field label="Minimum order value ₹" error={errors.minOrderValue}>{(p) => <Input {...p} inputMode="numeric" value={editing.minOrderValue} onChange={(e) => set("minOrderValue", e.target.value)} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" error={errors.startsAt}>{(p) => <Input {...p} type="datetime-local" value={editing.startsAt} onChange={(e) => set("startsAt", e.target.value)} />}</Field>
              <Field label="Expires" error={errors.expiresAt}>{(p) => <Input {...p} type="datetime-local" value={editing.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total uses (blank = ∞)" error={errors.usageLimit}>{(p) => <Input {...p} inputMode="numeric" value={editing.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} />}</Field>
              <Field label="Uses per customer" error={errors.perUserLimit}>{(p) => <Input {...p} inputMode="numeric" value={editing.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} />}</Field>
            </div>
            <Checkbox label="Active" checked={editing.active} onChange={(e) => set("active", e.target.checked)} />
          </div>
        )}
      </Sheet>
    </>
  );
}

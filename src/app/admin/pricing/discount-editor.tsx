"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { applyGlobalDiscount, previewGlobalDiscount, type DiscountPreview } from "@/server/actions/admin/pricing";

export function DiscountEditor({ current }: { current: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [preview, setPreview] = useState<DiscountPreview | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="border border-border bg-surface p-5 md:p-8" aria-labelledby="global-heading">
      <h2 id="global-heading" className="text-2xl">Global discount</h2>
      <p className="mt-1 text-sm text-fg-muted">Currently <strong className="text-gold">{current}%</strong> on all products without their own rule.</p>
      <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => { const r = await previewGlobalDiscount(Number(value)); if (r.ok) setPreview(r.data); else toast.error(r.fieldErrors ? Object.values(r.fieldErrors)[0]?.[0] ?? r.error : r.error); });
      }}>
        <label className="flex flex-col gap-2">
          <span className="eyebrow text-fg-muted">New discount %</span>
          <span className="flex items-center gap-2">
            <input value={value} onChange={(e) => { setValue(e.target.value.replace(/[^0-9.]/g, "")); setPreview(null); }} inputMode="decimal"
              className="h-12 w-28 rounded-[2px] border border-border bg-bg px-3 text-lg focus:border-gold focus:outline-none" data-testid="global-discount-input" />
            <span className="text-lg">%</span>
          </span>
        </label>
        {[0, 2, 5, 7.5, 10].map((q) => (
          <button key={q} type="button" onClick={() => { setValue(String(q)); setPreview(null); }} className="min-h-12 rounded-full border border-border px-4 text-sm hover:border-gold">{q}%</button>
        ))}
        <Button type="submit" variant="outline" loading={pending && !preview} data-testid="preview-discount">Preview</Button>
      </form>

      {preview && (
        <div className="mt-8" data-testid="discount-preview">
          <p className="text-sm">
            {preview.oldPct}% → <strong className="text-gold">{preview.newPct}%</strong>: <strong>{preview.affected}</strong> prices will change, {preview.unaffected} stay the same.
          </p>
          <ul className="mt-4 max-h-80 divide-y divide-border overflow-y-auto border-y border-border text-sm">
            {preview.samples.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{s.name}{s.note && <span className="ml-2 text-xs text-fg-subtle">{s.note}</span>}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="text-fg-muted">MRP {formatINR(s.mrp)}</span> · {formatINR(s.oldPrice)} <ArrowRight className="size-3.5" aria-hidden /> <strong className={s.newPrice !== s.oldPrice ? "text-gold" : undefined}>{formatINR(s.newPrice)}</strong>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-3">
            <Button loading={pending} data-testid="apply-discount" onClick={() => start(async () => {
              const r = await applyGlobalDiscount(preview.newPct);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              setPreview(null);
              router.refresh();
            })}>Apply to all products</Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

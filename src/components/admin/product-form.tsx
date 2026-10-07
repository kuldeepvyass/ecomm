"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatINR } from "@/lib/money";
import { MOVEMENT_LABEL } from "@/lib/catalog/classify";
import { priceFor } from "@/lib/pricing";
import { saveProduct } from "@/server/actions/admin/products";
import { ImageManager, type ManagedImage } from "./image-manager";

export type ProductFormValues = Record<string, string | number | boolean | null | string[]> & { collections: string[] };

function Section({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-8 first:pt-0">
      <h2 className="text-2xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

const S = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function ProductForm({ id, initial, initialImages, brands, collections, globalPct, viewUrl }: {
  id?: string;
  initial: ProductFormValues;
  initialImages: ManagedImage[];
  brands: string[];
  collections: string[];
  globalPct: number;
  viewUrl?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [images, setImages] = useState(initialImages);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const [newCollection, setNewCollection] = useState("");
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val as never }));
  const text = (k: string, label: string, opts: { required?: boolean; type?: string; inputMode?: "numeric" | "decimal"; hint?: string; span?: boolean; list?: string } = {}) => (
    <Field label={label} error={errors[k]} required={opts.required} hint={opts.hint} className={opts.span ? "sm:col-span-2 lg:col-span-3" : undefined}>
      {(p) => <Input {...p} type={opts.type ?? "text"} inputMode={opts.inputMode} list={opts.list} value={S(v[k])} onChange={(e) => set(k, e.target.value)} />}
    </Field>
  );

  const mrp = Number(v.mrp) || 0;
  const override = v.discountOverridePct === "" || v.discountOverridePct === null ? null : Number(v.discountOverridePct);
  const preview = mrp > 0 ? priceFor({ mrp: Math.round(mrp), discountOverridePct: override, excludeFromGlobalDiscount: Boolean(v.excludeFromGlobalDiscount) }, globalPct) : null;

  function submit() {
    start(async () => {
      const res = await saveProduct({ id, product: v, images });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      toast.success(res.message ?? "Saved");
      if (!id) router.replace(`/admin/products/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate data-testid="product-form">
      {Object.keys(errors).length > 0 && (
        <div role="alert" className="mb-6 border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          Please fix: {Object.entries(errors).map(([k, e]) => `${k} — ${e?.[0]}`).join("; ")}
        </div>
      )}
      <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>

      <Section title="Identity">
        {text("brand", "Brand", { required: true, list: "brand-list", hint: "Pick an existing maison or type a new one" })}
        {text("modelName", "Model name", { required: true })}
        {text("referenceNumber", "Reference number", { required: true })}
        {text("sku", "SKU", { required: true, hint: "Unique; used by the bulk importer" })}
        {text("slug", "URL slug", { hint: "Leave blank to generate" })}
        {text("series", "Collection / line", { hint: "Brand's own line, e.g. \"Armani Exchange Chronograph\"" })}
        {text("brandOrigin", "Brand origin", { hint: "e.g. Switzerland, Japan" })}
        <Field label="Gender" required error={errors.gender}>
          {(p) => <Select {...p} value={S(v.gender)} onChange={(e) => set("gender", e.target.value)}><option value="MEN">Men</option><option value="WOMEN">Women</option><option value="UNISEX">Unisex</option></Select>}
        </Field>
        <Field label="Description" required error={errors.description} className="sm:col-span-2 lg:col-span-3">
          {(p) => <Textarea {...p} rows={5} value={S(v.description)} onChange={(e) => set("description", e.target.value)} />}
        </Field>
      </Section>

      <section className="border-b border-border py-8">
        <h2 className="text-2xl">Images</h2>
        <p className="mb-5 mt-1 text-sm text-fg-muted">Drag to reorder — the first image is the cover. 3–5 angles recommended.</p>
        <ImageManager images={images} onChange={setImages} />
      </section>

      <Section title="Pricing & stock" description={`Prices are GST-inclusive. Current global discount: ${globalPct}%.`}>
        {text("mrp", "MRP (₹)", { required: true, inputMode: "numeric" })}
        {text("costPrice", "Cost price (₹, admin only)", { inputMode: "numeric" })}
        {text("discountOverridePct", "Own discount % (overrides global)", { inputMode: "decimal", hint: "Leave blank to follow the global discount" })}
        <div className="flex items-end"><Checkbox label="Exclude from global discount" checked={Boolean(v.excludeFromGlobalDiscount)} onChange={(e) => set("excludeFromGlobalDiscount", e.target.checked)} /></div>
        {text("stock", "Stock quantity", { required: true, inputMode: "numeric" })}
        {text("lowStockAt", "Low-stock alert at", { inputMode: "numeric" })}
        {text("hsnCode", "HSN code", { inputMode: "numeric" })}
        {text("gstRatePct", "GST rate %", { inputMode: "decimal" })}
        <div className="flex flex-col justify-end border border-gold/40 bg-gold-soft p-4 text-sm sm:col-span-2 lg:col-span-1">
          <p className="eyebrow text-gold">Selling price</p>
          <p className="mt-1 text-2xl">{preview ? formatINR(preview.price) : "—"}</p>
          {preview && <p className="text-xs text-fg-muted">{preview.pct}% off · save {formatINR(preview.savings)}</p>}
        </div>
      </Section>

      <Section title="Specifications">
        {text("caseMaterial", "Case material", { required: true })}
        {text("caseDiameterMm", "Case diameter (mm)", { required: true, inputMode: "decimal" })}
        {text("caseThicknessMm", "Case thickness (mm)", { inputMode: "decimal" })}
        {text("lugWidthMm", "Lug width (mm)", { inputMode: "numeric" })}
        {text("dialColour", "Dial colour", { required: true })}
        {text("strapMaterial", "Strap / bracelet material", { required: true })}
        {text("strapColour", "Strap colour")}
        {text("watchType", "Type", { hint: "Analog, Chronograph, Diver, Digital, Smart…" })}
        {text("caseShape", "Case shape", { hint: "Round, Square, Rectangular, Tonneau…" })}
        <Field label="Movement" required error={errors.movement}>
          {(p) => <Select {...p} value={S(v.movement)} onChange={(e) => set("movement", e.target.value)}>{Object.entries(MOVEMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}
        </Field>
        {text("calibre", "Calibre")}
        {text("powerReserveHours", "Power reserve (hours)", { inputMode: "numeric" })}
        {text("waterResistanceM", "Water resistance (m)", { inputMode: "numeric" })}
        {text("crystal", "Crystal")}
        {text("weightGrams", "Weight (g)", { inputMode: "numeric" })}
        {text("warrantyMonths", "Warranty (months)", { inputMode: "numeric" })}
        {text("functions", "Functions", { hint: "e.g. Chronograph, small seconds, date", span: true })}
        {text("specialFeatures", "Highlight", { hint: "One line shown above the specs", span: true })}
        <div className="flex items-end"><Checkbox label="Box & papers included" checked={Boolean(v.boxAndPapers)} onChange={(e) => set("boxAndPapers", e.target.checked)} /></div>
      </Section>

      <section className="border-b border-border py-8">
        <h2 className="text-2xl">Collections</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...new Set([...collections, ...v.collections])].map((c) => {
            const on = v.collections.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => set("collections", on ? v.collections.filter((x) => x !== c) : [...v.collections, c])}
                className={on ? "min-h-10 rounded-full border border-gold bg-gold-soft px-4 text-sm text-gold" : "min-h-10 rounded-full border border-border px-4 text-sm text-fg-muted"}>{c}</button>
            );
          })}
          <span className="flex gap-2">
            <input value={newCollection} onChange={(e) => setNewCollection(e.target.value)} placeholder="New collection" aria-label="New collection name" className="h-10 w-40 rounded-[2px] border border-border bg-surface px-3 text-sm" />
            <Button type="button" size="sm" variant="outline" className="h-10" disabled={!newCollection.trim()} onClick={() => { set("collections", [...v.collections, newCollection.trim()]); setNewCollection(""); }}>Add</Button>
          </span>
        </div>
      </section>

      <Section title="Visibility & SEO">
        <Field label="Status" error={errors.status}>
          {(p) => <Select {...p} value={S(v.status)} onChange={(e) => set("status", e.target.value)}><option value="DRAFT">Draft (hidden)</option><option value="ACTIVE">Active (live)</option></Select>}
        </Field>
        <div className="flex items-end"><Checkbox label="Featured on homepage" checked={Boolean(v.featured)} onChange={(e) => set("featured", e.target.checked)} /></div>
        <div />
        {text("seoTitle", "SEO title", { hint: "≤ 70 characters", span: true })}
        <Field label="SEO description" error={errors.seoDescription} hint="≤ 170 characters" className="sm:col-span-2 lg:col-span-3">
          {(p) => <Textarea {...p} rows={2} value={S(v.seoDescription)} onChange={(e) => set("seoDescription", e.target.value)} />}
        </Field>
      </Section>

      <Section title="External rating (optional)" description="Only enter a real rating copied from a named source — e.g. 4.6 from 1,240 ratings on Amazon.in. Leave blank to show nothing.">
        {text("externalRating", "Rating (0–5, one decimal)", { inputMode: "decimal" })}
        {text("externalRatingCount", "Number of ratings", { inputMode: "numeric" })}
        {text("externalRatingSource", "Source (e.g. Amazon.in)")}
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        {viewUrl && <Button asChild variant="ghost"><Link href={viewUrl} target="_blank"><ExternalLink aria-hidden /> View in store</Link></Button>}
        <Button type="submit" loading={pending} data-testid="save-product">{id ? "Save changes" : "Create product"}</Button>
      </div>
    </form>
  );
}

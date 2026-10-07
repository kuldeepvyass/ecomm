"use client";

import { Copy, Pencil, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { LINKED_IMAGE_PROPS, cdnLoader, isLinkedImage } from "@/lib/image-loader";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { bulkProductAction, duplicateProduct, purgeDeleted, updateStock } from "@/server/actions/admin/products";

type Item = {
  id: string; sku: string; modelName: string; referenceNumber: string; slug: string; mrp: number; sellingPrice: number; stock: number;
  status: "ACTIVE" | "DRAFT"; featured: boolean; isDemo: boolean; deletedAt: Date | null; effectiveDiscountPct: number;
  brand: { name: string; slug: string }; image: string | null;
};

const VIEWS = [["all", "All"], ["active", "Active"], ["draft", "Draft"], ["low", "Low stock"], ["trash", "Trash"]] as const;

export function ProductsTable({ items, total, next, brands, view, q, brand }: {
  items: Item[]; total: number; next: string | null; brands: { name: string; slug: string }[]; view: string; q: string; brand: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(q);

  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(view !== "all" ? { view } : {}), ...(brand ? { brand } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    router.push(`${pathname}?${p}`);
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = items.length > 0 && items.every((i) => selected.has(i.id));

  function bulk(action: Parameters<typeof bulkProductAction>[1]) {
    if (action === "delete" && !confirm(`Move ${selected.size} product(s) to trash? You can restore them later.`)) return;
    start(async () => {
      const res = await bulkProductAction([...selected], action);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" onClick={() => go({ view: v === "all" ? "" : v, cursor: "" })}
              className={cn("min-h-10 whitespace-nowrap rounded-full border px-4 text-xs uppercase tracking-[0.12em]", view === v ? "border-gold text-gold" : "border-border text-fg-muted")}>{label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={brand} onChange={(e) => go({ brand: e.target.value, cursor: "" })} aria-label="Filter by brand"
            className="h-10 rounded-[2px] border border-border bg-surface px-3 text-sm">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); go({ q: search, cursor: "" }); }} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, model, ref…" aria-label="Search products"
              className="h-10 w-48 rounded-[2px] border border-border bg-surface pl-9 pr-3 text-sm focus:border-gold focus:outline-none md:w-64" />
          </form>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border border-gold/40 bg-surface p-3 lg:top-2">
          <span className="mr-2 text-sm">{selected.size} selected</span>
          {view === "trash" ? (
            <>
              <Button size="sm" variant="outline" loading={pending} onClick={() => bulk("restore")}>Restore</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => {
                if (!confirm("Permanently delete? Products with orders are kept for your records.")) return;
                start(async () => { const r = await purgeDeleted([...selected]); if (r.ok) { toast.success(r.message); setSelected(new Set()); router.refresh(); } else toast.error(r.error); });
              }}>Delete permanently</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" loading={pending} onClick={() => bulk("activate")}>Activate</Button>
              <Button size="sm" variant="outline" loading={pending} onClick={() => bulk("deactivate")}>Deactivate</Button>
              <Button size="sm" variant="outline" loading={pending} onClick={() => bulk("feature")}>Feature</Button>
              <Button size="sm" variant="outline" loading={pending} onClick={() => bulk("unfeature")}>Unfeature</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => bulk("delete")}>Delete</Button>
            </>
          )}
        </div>
      )}

      <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
        <table className="w-full min-w-[760px] text-sm" data-testid="admin-products-table">
          <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSelected(all ? new Set() : new Set(items.map((i) => i.id)))} className="size-4 accent-[var(--gold)]" /></th>
              <th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3 text-right">MRP</th><th className="p-3 text-right">Price</th>
              <th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((p) => (
              <tr key={p.id} className={cn(selected.has(p.id) && "bg-gold-soft")}>
                <td className="p-3"><input type="checkbox" aria-label={`Select ${p.modelName}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-[var(--gold)]" /></td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="relative size-12 shrink-0 overflow-hidden bg-surface-2">{p.image && (isLinkedImage(p.image) ? <Image {...LINKED_IMAGE_PROPS} src={p.image} alt="" fill sizes="48px" className="bg-white object-contain" /> : <Image loader={cdnLoader} src={p.image} alt="" fill sizes="48px" className="object-cover" />)}</span>
                    <span className="min-w-0">
                      <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-gold">{p.modelName}</Link>
                      <span className="block text-xs text-fg-muted">{p.brand.name} · {p.referenceNumber}</span>
                    </span>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{p.sku}</td>
                <td className="p-3 text-right">{formatINR(p.mrp)}</td>
                <td className="p-3 text-right">{formatINR(p.sellingPrice)}{p.effectiveDiscountPct > 0 && <span className="block text-xs text-gold">−{p.effectiveDiscountPct}%</span>}</td>
                <td className="p-3"><StockCell id={p.id} stock={p.stock} /></td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {p.deletedAt ? <Badge tone="danger">Trash</Badge> : <Badge tone={p.status === "ACTIVE" ? "success" : "outline"}>{p.status.toLowerCase()}</Badge>}
                    {p.featured && <Badge tone="gold">Featured</Badge>}
                    {p.isDemo && <Badge tone="outline">Sample</Badge>}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Link href={`/admin/products/${p.id}`} className="grid size-10 place-items-center hover:text-gold" aria-label={`Edit ${p.modelName}`}><Pencil className="size-4" aria-hidden /></Link>
                    <button type="button" className="grid size-10 place-items-center hover:text-gold" aria-label={`Duplicate ${p.modelName}`} onClick={() => start(async () => {
                      const r = await duplicateProduct(p.id);
                      if (r.ok) router.push(`/admin/products/${r.data.id}`); else toast.error(r.error);
                    })}><Copy className="size-4" aria-hidden /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-fg-muted">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span>{total} products</span>
        {next && <Button variant="outline" size="sm" onClick={() => go({ cursor: next })}>Next page</Button>}
      </div>
    </div>
  );
}

function StockCell({ id, stock }: { id: string; stock: number }) {
  const [value, setValue] = useState(String(stock));
  const [pending, start] = useTransition();
  const dirty = Number(value) !== stock;
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await updateStock(id, Number(value)); if (r.ok) toast.success("Stock updated"); else { toast.error(r.error); setValue(String(stock)); } });
    }}>
      <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Stock quantity"
        className={cn("h-9 w-16 rounded-[2px] border bg-surface px-2 text-sm", stock <= 2 ? "border-warning/60" : "border-border")} />
      {dirty && <Button type="submit" size="sm" className="h-9 px-3" loading={pending}>Save</Button>}
    </form>
  );
}

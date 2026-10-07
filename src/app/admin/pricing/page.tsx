import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { currentGlobalPct } from "@/server/catalog/admin";
import { DiscountEditor } from "./discount-editor";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  await requireAdmin();
  const [pct, log, overrides] = await Promise.all([
    currentGlobalPct(),
    db.priceChangeLog.findMany({ where: { productId: null }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { email: true, name: true } } } }),
    db.product.findMany({
      where: { deletedAt: null, OR: [{ discountOverridePct: { not: null } }, { excludeFromGlobalDiscount: true }] },
      select: { id: true, modelName: true, mrp: true, sellingPrice: true, discountOverridePct: true, excludeFromGlobalDiscount: true, brand: { select: { name: true } } },
      orderBy: { modelName: "asc" },
    }),
  ]);
  return (
    <div className="flex flex-col gap-12">
      <PageHeader title="Pricing" description="Selling price = MRP × (1 − discount%), rounded to the nearest rupee, computed on the server. A product's own discount always wins over the global one." />
      <DiscountEditor current={pct} />

      <section>
        <h2 className="mb-3 text-2xl">Per-product overrides ({overrides.length})</h2>
        {overrides.length === 0 ? <p className="text-sm text-fg-muted">None — every product follows the global discount. Set an override from the product&apos;s edit page.</p> : (
          <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted"><tr><th className="p-3">Product</th><th className="p-3">Rule</th><th className="p-3 text-right">MRP</th><th className="p-3 text-right">Price</th></tr></thead>
              <tbody className="divide-y divide-border">
                {overrides.map((o) => (
                  <tr key={o.id}>
                    <td className="p-3"><Link href={`/admin/products/${o.id}`} className="hover:text-gold">{o.brand.name} {o.modelName}</Link></td>
                    <td className="p-3">{o.discountOverridePct !== null ? `Own discount ${Number(o.discountOverridePct)}%` : "Excluded from global"}</td>
                    <td className="p-3 text-right">{formatINR(o.mrp)}</td><td className="p-3 text-right">{formatINR(o.sellingPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-2xl">Global discount change log</h2>
        <ul className="divide-y divide-border border-y border-border text-sm" data-testid="pricing-log">
          {log.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-3">
              <span><strong className="font-medium">{l.oldValue} → {l.newValue}</strong> <span className="text-fg-muted">· {l.affectedCount ?? 0} prices changed</span></span>
              <span className="text-fg-muted">{l.actor.name ?? l.actor.email} · {l.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
            </li>
          ))}
          {log.length === 0 && <li className="py-3 text-fg-muted">No changes yet.</li>}
        </ul>
      </section>
    </div>
  );
}

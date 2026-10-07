"use client";

import { GitCompareArrows, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/providers";
import { PriceTag } from "@/components/product/price-tag";
import { Stars } from "@/components/product/rating";
import { WatchImage } from "@/components/product/watch-image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

type Spec = Record<string, string | number | null> & { id: string; href: string; brand: string; modelName: string; image: string | null; mrp: number; price: number; ratingAvg: number; ratingCount: number };

const ROWS: [string, string][] = [
  ["referenceNumber", "Reference"], ["watchType", "Type"], ["functions", "Functions"], ["caseMaterial", "Case"], ["caseShape", "Case shape"], ["caseDiameterMm", "Diameter (mm)"], ["caseThicknessMm", "Thickness (mm)"],
  ["dialColour", "Dial"], ["strapMaterial", "Strap"], ["movement", "Movement"], ["calibre", "Calibre"], ["powerReserveHours", "Power reserve (h)"],
  ["waterResistanceM", "Water resistance (m)"], ["crystal", "Crystal"], ["weightGrams", "Weight (g)"], ["warrantyMonths", "Warranty (months)"], ["stock", "Availability"],
];

export function CompareView() {
  const { compare, toggleCompare, clearCompare } = useStore();
  const [items, setItems] = useState<Spec[] | null>(null);
  const key = compare.join(",");

  useEffect(() => {
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to compare
      setItems([]);
      return;
    }
    fetch(`/api/compare?ids=${key}`).then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [key]);

  if (items === null) return <div className="skeleton h-96" />;
  if (items.length === 0) {
    return <EmptyState icon={<GitCompareArrows />} title="Nothing to compare yet" description="Use “Compare” on any watch page to add up to 3 watches."
      action={<Button asChild><Link href="/watches">Browse watches</Link></Button>} />;
  }
  return (
    <div>
      <div className="mb-4 flex justify-end"><Button variant="link" onClick={clearCompare}>Clear all</Button></div>
      <div tabIndex={0} role="region" aria-label="Comparison table" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm" data-testid="compare-table">
          <caption className="sr-only">Side-by-side comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="w-36 md:w-48"><span className="sr-only">Specification</span></th>
              {items.map((p) => (
                <th key={p.id} scope="col" className="px-3 pb-6 text-left align-top font-normal">
                  <div className="relative">
                    <button type="button" onClick={() => toggleCompare(p.id)} aria-label={`Remove ${p.modelName}`} className="absolute right-0 top-0 z-10 grid size-10 place-items-center rounded-full bg-bg/70"><X className="size-4" aria-hidden /></button>
                    <Link href={p.href} className="relative block aspect-[4/5] overflow-hidden bg-surface-2">
                      {p.image && <WatchImage src={p.image} alt="" fill sizes="240px" className="object-cover" />}
                    </Link>
                    <p className="small-caps mt-3 text-xs text-fg-muted">{p.brand}</p>
                    <Link href={p.href} className="font-display text-lg leading-tight hover:text-gold">{p.modelName}</Link>
                    <PriceTag mrp={p.mrp} price={p.price} size="sm" className="mt-1" />
                    {p.ratingCount > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted"><Stars value={p.ratingAvg} size={12} /> ({p.ratingCount})</p>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([k, label]) => (
              <tr key={k} className="border-t border-border">
                <th scope="row" className="py-3 pr-3 text-left font-normal text-fg-muted">{label}</th>
                {items.map((p) => (
                  <td key={p.id} className="px-3 py-3">{k === "stock" ? (Number(p.stock) > 0 ? "In stock" : "Sold out") : (p[k] ?? "—")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

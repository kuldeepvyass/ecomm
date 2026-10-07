import { MOVEMENT_LABEL } from "@/lib/catalog/classify";
import type { ProductDetail } from "@/server/catalog/queries";

const MOVEMENT: Record<string, string> = { ...MOVEMENT_LABEL, AUTOMATIC: "Automatic (self-winding)" };

export function SpecTable({ p }: { p: ProductDetail }) {
  const rows: [string, string | null][] = [
    ["Reference", p.referenceNumber],
    ["Collection", p.series],
    ["Type", p.watchType],
    ["Functions", p.functions],
    ["Case material", p.caseMaterial],
    ["Case shape", p.caseShape],
    ["Case diameter", `${p.caseDiameterMm} mm`],
    ["Case thickness", p.caseThicknessMm ? `${p.caseThicknessMm} mm` : null],
    ["Lug width", p.lugWidthMm ? `${p.lugWidthMm} mm` : null],
    ["Dial", p.dialColour],
    ["Strap / bracelet", [p.strapMaterial, p.strapColour].filter(Boolean).join(", ")],
    ["Movement", MOVEMENT[p.movement]],
    ["Calibre", p.calibre],
    ["Power reserve", p.powerReserveHours ? `${p.powerReserveHours} hours` : null],
    ["Water resistance", p.waterResistanceM ? `${p.waterResistanceM} m (${Math.round(p.waterResistanceM / 10)} bar)` : null],
    ["Crystal", p.crystal],
    ["Weight", p.weightGrams ? `${p.weightGrams} g` : null],
    ["Warranty", p.warrantyMonths ? `${p.warrantyMonths / 12 >= 1 && p.warrantyMonths % 12 === 0 ? `${p.warrantyMonths / 12} years` : `${p.warrantyMonths} months`}`: null],
    ["Box & papers", p.boxAndPapers ? "Included" : "Not included"],
    ["Brand origin", p.brand.origin],
    ["Gender", p.gender === "MEN" ? "Men" : p.gender === "WOMEN" ? "Women" : "Unisex"],
    ["SKU", p.sku],
  ];
  return (
    <>
    {p.specialFeatures && (
      <p className="mb-4 border-l-2 border-gold bg-gold-soft px-4 py-3 text-sm"><span className="eyebrow mr-2 text-gold">Highlight</span>{p.specialFeatures}</p>
    )}
    <dl className="grid grid-cols-1 divide-y divide-border border-y border-border text-sm sm:grid-cols-2 sm:divide-y-0">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-3 sm:border-b sm:border-border sm:odd:pr-6 sm:even:pl-6">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
    </>
  );
}

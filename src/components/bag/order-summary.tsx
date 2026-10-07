import { formatINR } from "@/lib/money";

export function SummaryRow({ label, value, muted, strong, testId }: { label: string; value: string; muted?: boolean; strong?: boolean; testId?: string }) {
  return (
    <div className={strong ? "flex justify-between border-t border-border pt-4 text-base font-medium" : "flex justify-between text-sm"}>
      <dt className={muted ? "text-fg-muted" : undefined}>{label}</dt>
      <dd className={muted ? "text-fg-muted" : undefined} data-testid={testId}>{value}</dd>
    </div>
  );
}

export function PriceBreakdown({ mrpTotal, itemsTotal, couponDiscount, couponCode, shippingFee, total }: {
  mrpTotal: number; itemsTotal: number; couponDiscount: number; couponCode?: string | null; shippingFee: number; total: number;
}) {
  const productSavings = mrpTotal - itemsTotal;
  return (
    <dl className="flex flex-col gap-3">
      <SummaryRow label="Total MRP" value={formatINR(mrpTotal)} muted />
      {productSavings > 0 && <SummaryRow label="Boutique discount" value={`− ${formatINR(productSavings)}`} muted />}
      {couponDiscount > 0 && <SummaryRow label={`Coupon${couponCode ? ` (${couponCode})` : ""}`} value={`− ${formatINR(couponDiscount)}`} muted testId="coupon-discount" />}
      <SummaryRow label="Insured shipping" value={shippingFee === 0 ? "Free" : formatINR(shippingFee)} muted />
      <SummaryRow label="Total (incl. GST)" value={formatINR(total)} strong testId="order-total" />
      {productSavings + couponDiscount > 0 && (
        <p className="text-sm text-success">You save {formatINR(productSavings + couponDiscount)} on this order</p>
      )}
    </dl>
  );
}

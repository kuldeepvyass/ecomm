/**
 * Pricing rules — the single source of truth, used server-side only for anything
 * that is persisted or charged. Client components may call these for display of
 * values the server already computed, never to decide what to charge.
 */

export type DiscountInput = {
  discountOverridePct: number | null;
  excludeFromGlobalDiscount: boolean;
};

export const MAX_DISCOUNT_PCT = 90;

/** Override wins; otherwise global unless the product is excluded. */
export function effectiveDiscountPct(product: DiscountInput, globalPct: number): number {
  const pct =
    product.discountOverridePct ?? (product.excludeFromGlobalDiscount ? 0 : globalPct);
  return clampPct(pct);
}

export function clampPct(pct: number): number {
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(pct, MAX_DISCOUNT_PCT);
}

/**
 * sellingPrice = MRP × (1 − pct/100), rounded to the nearest rupee.
 * Integer arithmetic in basis points avoids float drift (e.g. 7.5%).
 */
export function sellingPrice(mrp: number, pct: number): number {
  if (!Number.isInteger(mrp) || mrp < 0) throw new Error(`Invalid MRP: ${mrp}`);
  const bp = Math.round(clampPct(pct) * 100); // 7.5% → 750
  return Math.round((mrp * (10000 - bp)) / 10000);
}

export function priceFor(product: DiscountInput & { mrp: number }, globalPct: number) {
  const pct = effectiveDiscountPct(product, globalPct);
  const price = sellingPrice(product.mrp, pct);
  return { pct, price, savings: product.mrp - price };
}

/** Rounded % for the badge, computed from actual prices so it never overstates. */
export function discountBadgePct(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.floor(((mrp - price) / mrp) * 100);
}

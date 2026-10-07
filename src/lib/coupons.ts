export type CouponRule = {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  active: boolean;
};

export type CouponCheck =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

/**
 * Validates a coupon against a cart subtotal (after product discounts) and returns
 * the rupee discount. Pure: callers supply the user's prior redemption count.
 */
export function evaluateCoupon(
  coupon: CouponRule | null,
  subtotal: number,
  userRedemptions: number,
  now: Date = new Date(),
): CouponCheck {
  if (!coupon || !coupon.active) return { ok: false, reason: "This code isn't valid." };
  if (coupon.startsAt && now < coupon.startsAt)
    return { ok: false, reason: "This code isn't active yet." };
  if (coupon.expiresAt && now > coupon.expiresAt)
    return { ok: false, reason: "This code has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, reason: "This code has reached its usage limit." };
  if (coupon.perUserLimit !== null && userRedemptions >= coupon.perUserLimit)
    return { ok: false, reason: "You've already used this code." };
  if (subtotal < coupon.minOrderValue)
    return {
      ok: false,
      reason: `Add items worth ₹${(coupon.minOrderValue - subtotal).toLocaleString("en-IN")} more to use this code.`,
    };

  let discount =
    coupon.type === "PERCENT"
      ? Math.round((subtotal * Math.min(coupon.value, 100)) / 100)
      : Math.round(coupon.value);
  if (coupon.type === "PERCENT" && coupon.maxDiscount !== null)
    discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, subtotal));
  return { ok: true, discount };
}

import { describe, expect, it } from "vitest";
import { evaluateCoupon, type CouponRule } from "@/lib/coupons";

const base: CouponRule = {
  code: "WELCOME10",
  type: "PERCENT",
  value: 10,
  maxDiscount: null,
  minOrderValue: 0,
  startsAt: null,
  expiresAt: null,
  usageLimit: null,
  perUserLimit: 1,
  usedCount: 0,
  active: true,
};
const now = new Date("2026-10-06T10:00:00Z");

describe("evaluateCoupon", () => {
  it("computes percent discounts", () => {
    expect(evaluateCoupon(base, 200_000, 0, now)).toEqual({ ok: true, discount: 20_000 });
  });
  it("caps percent discounts at maxDiscount", () => {
    expect(evaluateCoupon({ ...base, maxDiscount: 5_000 }, 200_000, 0, now)).toEqual({ ok: true, discount: 5_000 });
  });
  it("computes flat discounts without exceeding the subtotal", () => {
    expect(evaluateCoupon({ ...base, type: "FLAT", value: 2_500 }, 100_000, 0, now)).toEqual({ ok: true, discount: 2_500 });
    expect(evaluateCoupon({ ...base, type: "FLAT", value: 2_500 }, 1_000, 0, now)).toEqual({ ok: true, discount: 1_000 });
  });
  it("enforces minimum order value", () => {
    const r = evaluateCoupon({ ...base, minOrderValue: 50_000 }, 40_000, 0, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("10,000");
  });
  it("enforces dates, limits and active flag", () => {
    expect(evaluateCoupon({ ...base, expiresAt: new Date("2026-10-01") }, 10_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, startsAt: new Date("2026-11-01") }, 10_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, usageLimit: 5, usedCount: 5 }, 10_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon(base, 10_000, 1, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, perUserLimit: null }, 10_000, 9, now).ok).toBe(true);
    expect(evaluateCoupon({ ...base, active: false }, 10_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon(null, 10_000, 0, now).ok).toBe(false);
  });
});

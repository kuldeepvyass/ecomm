import { describe, expect, it } from "vitest";
import { discountBadgePct, effectiveDiscountPct, priceFor, sellingPrice } from "@/lib/pricing";

describe("sellingPrice", () => {
  it("applies a whole-number discount", () => {
    expect(sellingPrice(1_000_000, 5)).toBe(950_000);
  });
  it("handles fractional percentages exactly", () => {
    expect(sellingPrice(100_000, 7.5)).toBe(92_500);
    expect(sellingPrice(33_333, 7.5)).toBe(30_833); // 30833.025 → 30833
  });
  it("rounds to the nearest rupee (half up)", () => {
    expect(sellingPrice(25_001, 2)).toBe(24_501); // 24500.98
    expect(sellingPrice(150, 1)).toBe(149); // 148.5 → 149
  });
  it("returns MRP for 0% and clamps invalid percentages", () => {
    expect(sellingPrice(45_000, 0)).toBe(45_000);
    expect(sellingPrice(45_000, -10)).toBe(45_000);
    expect(sellingPrice(100_000, 500)).toBe(10_000); // capped at 90%
    expect(sellingPrice(100_000, Number.NaN)).toBe(100_000);
  });
  it("rejects non-integer MRP", () => {
    expect(() => sellingPrice(10.5, 5)).toThrow();
  });
});

describe("effectiveDiscountPct", () => {
  const base = { discountOverridePct: null, excludeFromGlobalDiscount: false };
  it("uses the global discount by default", () => {
    expect(effectiveDiscountPct(base, 5)).toBe(5);
  });
  it("prefers a per-product override, even 0", () => {
    expect(effectiveDiscountPct({ ...base, discountOverridePct: 12 }, 5)).toBe(12);
    expect(effectiveDiscountPct({ ...base, discountOverridePct: 0 }, 5)).toBe(0);
  });
  it("respects the exclude flag unless overridden", () => {
    expect(effectiveDiscountPct({ ...base, excludeFromGlobalDiscount: true }, 5)).toBe(0);
    expect(effectiveDiscountPct({ discountOverridePct: 3, excludeFromGlobalDiscount: true }, 5)).toBe(3);
  });
});

describe("priceFor / badge", () => {
  it("reports savings", () => {
    expect(priceFor({ mrp: 1_000_000, discountOverridePct: null, excludeFromGlobalDiscount: false }, 5)).toEqual({
      pct: 5,
      price: 950_000,
      savings: 50_000,
    });
  });
  it("never overstates the badge", () => {
    expect(discountBadgePct(100_000, 92_500)).toBe(7);
    expect(discountBadgePct(100_000, 100_000)).toBe(0);
  });
});

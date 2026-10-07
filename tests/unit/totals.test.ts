import { describe, expect, it } from "vitest";
import { computeOrderTotals, splitInclusive } from "@/lib/orders/totals";

const line = { mrp: 1_000_000, unitPrice: 950_000, quantity: 1, gstRatePct: 18 };

describe("computeOrderTotals", () => {
  it("splits intra-state GST into CGST + SGST", () => {
    const t = computeOrderTotals({
      lines: [line], couponDiscount: 0, shippingFee: 0, freeShippingThreshold: null,
      sellerStateCode: "MH", shipStateCode: "MH",
    });
    expect(t.grandTotal).toBe(950_000);
    expect(t.taxableValue).toBe(805_085);
    expect(t.cgst + t.sgst).toBe(144_915);
    expect(t.igst).toBe(0);
    expect(t.taxableValue + t.cgst + t.sgst).toBe(t.grandTotal);
  });
  it("uses IGST for inter-state and includes shipping and coupon", () => {
    const t = computeOrderTotals({
      lines: [line, { mrp: 50_000, unitPrice: 47_500, quantity: 2, gstRatePct: 18 }],
      couponDiscount: 10_000, shippingFee: 500, freeShippingThreshold: null,
      sellerStateCode: "MH", shipStateCode: "KA",
    });
    expect(t.itemsTotal).toBe(1_045_000);
    expect(t.mrpTotal).toBe(1_100_000);
    expect(t.grandTotal).toBe(1_045_000 - 10_000 + 500);
    expect(t.cgst).toBe(0);
    expect(t.taxableValue + t.igst).toBe(t.grandTotal);
  });
  it("waives shipping above the free-shipping threshold", () => {
    const t = computeOrderTotals({
      lines: [line], couponDiscount: 0, shippingFee: 500, freeShippingThreshold: 50_000,
      sellerStateCode: "MH", shipStateCode: "MH",
    });
    expect(t.shippingFee).toBe(0);
  });
  it("never lets the coupon exceed the items total", () => {
    const t = computeOrderTotals({
      lines: [{ ...line, unitPrice: 1_000 }], couponDiscount: 5_000, shippingFee: 0, freeShippingThreshold: null,
      sellerStateCode: "MH", shipStateCode: "MH",
    });
    expect(t.couponDiscount).toBe(1_000);
    expect(t.grandTotal).toBe(0);
  });
  it("back-calculates inclusive GST", () => {
    expect(splitInclusive(118, 18)).toEqual({ taxable: 100, tax: 18 });
  });
});

import { allocateDiscount } from "@/lib/orders/totals";
describe("allocateDiscount", () => {
  it("shares sum exactly to the discount", () => {
    const s = allocateDiscount([333, 333, 334], 100);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocateDiscount([], 0)).toEqual([]);
  });
});

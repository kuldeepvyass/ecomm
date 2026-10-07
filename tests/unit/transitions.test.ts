import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  isCustomerCancellable,
  isReturnEligible,
  restoresStock,
  TRANSITIONS,
} from "@/lib/orders/transitions";

describe("order transitions", () => {
  it("allows the full UPI happy path", () => {
    const path = ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("lets a rejected UTR be resubmitted, but never skips verification", () => {
    expect(canTransition("PAYMENT_SUBMITTED", "PAYMENT_FAILED")).toBe(true);
    expect(canTransition("PAYMENT_FAILED", "PAYMENT_SUBMITTED")).toBe(true);
    expect(canTransition("PAYMENT_SUBMITTED", "SHIPPED")).toBe(false);
    expect(canTransition("PAYMENT_SUBMITTED", "PROCESSING")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "PROCESSING")).toBe(false);
  });
  it("allows return → refund", () => {
    expect(canTransition("DELIVERED", "RETURN_REQUESTED")).toBe(true);
    expect(canTransition("RETURN_REQUESTED", "RETURNED")).toBe(true);
    expect(canTransition("RETURNED", "REFUNDED")).toBe(true);
  });
  it("rejects skipping and going backwards", () => {
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(canTransition("DELIVERED", "SHIPPED")).toBe(false);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(() => assertTransition("REFUNDED", "PAID")).toThrow(/cannot move/);
  });
  it("has no outgoing transitions from REFUNDED", () => {
    expect(TRANSITIONS.REFUNDED).toHaveLength(0);
  });
  it("lets customers cancel only before shipping", () => {
    expect(isCustomerCancellable("PROCESSING")).toBe(true);
    expect(isCustomerCancellable("SHIPPED")).toBe(false);
    expect(isCustomerCancellable("DELIVERED")).toBe(false);
  });
  it("enforces the return window", () => {
    const delivered = new Date("2026-10-01T00:00:00Z");
    expect(isReturnEligible("DELIVERED", delivered, 7, new Date("2026-10-07T00:00:00Z"))).toBe(true);
    expect(isReturnEligible("DELIVERED", delivered, 7, new Date("2026-10-09T00:00:00Z"))).toBe(false);
    expect(isReturnEligible("SHIPPED", delivered, 7, new Date("2026-10-02T00:00:00Z"))).toBe(false);
  });
  it("restores reserved stock on cancellation and return", () => {
    expect(restoresStock("PAID", "CANCELLED")).toBe(true);
    expect(restoresStock("PROCESSING", "CANCELLED")).toBe(true);
    expect(restoresStock("PENDING_PAYMENT", "CANCELLED")).toBe(true);
    expect(restoresStock("PAYMENT_SUBMITTED", "CANCELLED")).toBe(true);
    expect(restoresStock("PAID", "PROCESSING")).toBe(false);
    expect(restoresStock("RETURN_REQUESTED", "RETURNED")).toBe(true);
  });
});

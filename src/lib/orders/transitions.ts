import type { OrderStatus } from "@/generated/prisma/enums";

/** Allowed order status transitions. Anything not listed is rejected. */
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  // UPI: customer submits a UTR → PAYMENT_SUBMITTED. Admin may also confirm directly (e.g. payment seen before the UTR arrives).
  PENDING_PAYMENT: ["PAYMENT_SUBMITTED", "PAID", "CANCELLED"],
  PAYMENT_SUBMITTED: ["PAID", "PAYMENT_FAILED", "CANCELLED"], // admin confirms or rejects the UTR
  PAYMENT_FAILED: ["PAYMENT_SUBMITTED", "PAID", "CANCELLED"], // customer can resubmit a corrected UTR
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"], // DELIVERED = return rejected
  RETURNED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public from: OrderStatus,
    public to: OrderStatus,
  ) {
    super(`Order cannot move from ${from} to ${to}`);
  }
}

/** Customers may cancel until the parcel ships. */
export function isCustomerCancellable(status: OrderStatus): boolean {
  return ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAYMENT_FAILED", "PAID", "PROCESSING"].includes(status);
}

/** Statuses in which the order is waiting on (or re-trying) a UPI payment. */
export function awaitingPayment(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED";
}

export function isReturnEligible(status: OrderStatus, deliveredAt: Date | null, windowDays: number, now = new Date()) {
  if (status !== "DELIVERED" || !deliveredAt) return false;
  const deadline = deliveredAt.getTime() + windowDays * 86_400_000;
  return now.getTime() <= deadline;
}

/**
 * Stock is reserved when an order is placed, so cancelling from any
 * pre-shipment status — or receiving a return — puts it back.
 */
export function restoresStock(from: OrderStatus, to: OrderStatus): boolean {
  const reserved = ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAYMENT_FAILED", "PAID", "PROCESSING"].includes(from);
  return (to === "CANCELLED" && reserved) || to === "RETURNED";
}

/** The happy-path sequence, used for the customer timeline. */
export const FULFILMENT_STEPS: readonly OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_SUBMITTED: "Payment verification pending",
  PAID: "Payment confirmed",
  PROCESSING: "Being prepared",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  PAYMENT_FAILED: "Payment failed",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

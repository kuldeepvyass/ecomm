"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { InvalidTransitionError } from "@/lib/orders/transitions";
import { assertAdmin } from "@/lib/session";
import { sanitizeText } from "@/lib/text";
import { logAudit } from "@/server/audit";
import { CheckoutError, completeRefund, confirmUpiPayment, issueRefund, rejectUpiPayment, transitionOrder } from "@/server/orders/service";
import { ok, runAction, UserFacingError, type ActionResult } from "../result";

const STATUSES = ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "PAYMENT_FAILED", "RETURN_REQUESTED", "RETURNED", "REFUNDED"] as const;

const statusSchema = z.object({
  orderId: z.string().cuid(),
  to: z.enum(STATUSES),
  note: z.string().trim().max(500).optional(),
  courierName: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
  trackingUrl: z.union([z.literal(""), z.string().trim().url("Tracking link must be a full URL").max(500)]).optional(),
});

function wrap<T>(fn: () => Promise<ActionResult<T>>) {
  return runAction<T>(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof CheckoutError || e instanceof InvalidTransitionError) throw new UserFacingError(e.message);
      throw e;
    }
  });
}

export async function updateOrderStatus(input: z.input<typeof statusSchema>): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    const d = statusSchema.parse(input);
    if (d.to === "PAID" || d.to === "PAYMENT_SUBMITTED" || d.to === "PAYMENT_FAILED") {
      throw new UserFacingError("Confirm or reject the UPI payment in the Payment panel (it checks the UTR).");
    }
    if (d.to === "SHIPPED" && !d.trackingNumber) {
      const o = await db.order.findUnique({ where: { id: d.orderId }, select: { trackingNumber: true } });
      if (!o?.trackingNumber) throw new UserFacingError("Add the courier and tracking number before marking as shipped.");
    }
    await transitionOrder(d.orderId, d.to, { id: admin.id, label: "admin" }, {
      note: d.note ? sanitizeText(d.note, 500) : null, courierName: d.courierName || null, trackingNumber: d.trackingNumber || null, trackingUrl: d.trackingUrl || null,
    });
    // Store cancelling a paid UPI order → log a pending refund to send back manually.
    if (d.to === "CANCELLED") {
      const o = await db.order.findUniqueOrThrow({ where: { id: d.orderId }, include: { payments: true } });
      if (o.payments.some((p) => p.status === "CONFIRMED")) await issueRefund(o.id, null, "Cancelled by store", admin.id);
    }
    revalidatePath(`/admin/orders/${d.orderId}`);
    return ok(null, "Status updated — customer notified by email");
  });
}

export async function saveTracking(input: { orderId: string; courierName: string; trackingNumber: string; trackingUrl: string }): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    const d = statusSchema.pick({ orderId: true, courierName: true, trackingNumber: true, trackingUrl: true }).parse(input);
    const before = await db.order.findUniqueOrThrow({ where: { id: d.orderId }, select: { courierName: true, trackingNumber: true, trackingUrl: true } });
    await db.order.update({ where: { id: d.orderId }, data: { courierName: d.courierName || null, trackingNumber: d.trackingNumber || null, trackingUrl: d.trackingUrl || null } });
    await logAudit({ actorId: admin.id, action: "order.tracking", entityType: "Order", entityId: d.orderId, diff: { trackingNumber: [before.trackingNumber, d.trackingNumber ?? null], courierName: [before.courierName, d.courierName ?? null] } });
    revalidatePath(`/admin/orders/${d.orderId}`);
    return ok(null, "Tracking saved");
  });
}

export async function refundOrder(input: { orderId: string; amount: number | null; reason: string; reference?: string }): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    const d = z.object({
      orderId: z.string().cuid(), amount: z.number().int().positive().nullable(), reason: z.string().trim().min(3, "Give a reason").max(200),
      reference: z.string().trim().max(60).optional(),
    }).parse(input);
    await issueRefund(d.orderId, d.amount, sanitizeText(d.reason, 200), admin.id, d.reference || null);
    revalidatePath(`/admin/orders/${d.orderId}`);
    return ok(null, d.reference ? "Refund recorded" : "Refund logged as pending — add the transfer reference once sent");
  });
}

export async function markRefundSent(refundId: string, reference: string): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    const ref = z.string().trim().min(6, "Enter the UTR / bank reference of your refund transfer").max(60).parse(reference);
    await completeRefund(z.string().cuid().parse(refundId), sanitizeText(ref, 60), admin.id);
    revalidatePath("/admin/payments");
    return ok(null, "Refund marked as sent — customer notified");
  });
}

export async function confirmPayment(paymentId: string): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    await confirmUpiPayment(z.string().cuid().parse(paymentId), admin.id);
    revalidatePath("/admin/payments");
    return ok(null, "Payment confirmed — order marked paid and customer emailed");
  });
}

export async function rejectPayment(paymentId: string, reason: string): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    const r = z.string().trim().min(3, "Tell the customer what went wrong").max(200).parse(reason);
    await rejectUpiPayment(z.string().cuid().parse(paymentId), admin.id, sanitizeText(r, 200));
    revalidatePath("/admin/payments");
    return ok(null, "Payment rejected — customer asked to resubmit");
  });
}

export async function decideReturn(input: { returnId: string; decision: "APPROVED" | "REJECTED" | "PICKED_UP" | "COMPLETED"; note?: string }): Promise<ActionResult<null>> {
  return wrap(async () => {
    const admin = await assertAdmin();
    const d = z.object({ returnId: z.string().cuid(), decision: z.enum(["APPROVED", "REJECTED", "PICKED_UP", "COMPLETED"]), note: z.string().max(300).optional() }).parse(input);
    const rr = await db.returnRequest.update({ where: { id: d.returnId }, data: { status: d.decision, adminNote: d.note } });
    if (d.decision === "REJECTED") await transitionOrder(rr.orderId, "DELIVERED", { id: admin.id, label: "admin" }, { note: `Return request declined${d.note ? `: ${d.note}` : ""}` });
    if (d.decision === "COMPLETED") await transitionOrder(rr.orderId, "RETURNED", { id: admin.id, label: "admin" }, { note: "Return received and inspected" });
    await logAudit({ actorId: admin.id, action: "order.return", entityType: "ReturnRequest", entityId: rr.id, diff: { status: [null, d.decision] } });
    revalidatePath(`/admin/orders/${rr.orderId}`);
    return ok(null, "Return updated");
  });
}

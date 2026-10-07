import "server-only";
import { revalidateTag } from "next/cache";
import { createElement } from "react";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { evaluateCoupon } from "@/lib/coupons";
import { sendEmail } from "@/lib/email/send";
import { BackInStockEmail } from "@/lib/email/templates/order-status";
import { pinMatchesState } from "@/lib/india";
import { TAGS } from "@/lib/cache-tags";
import { logger, reportError } from "@/lib/logger";
import { formatINR, toPaise } from "@/lib/money";
import { computeOrderTotals, computeShippingFee, type OrderTotals } from "@/lib/orders/totals";
import { assertTransition, awaitingPayment, isCustomerCancellable, isReturnEligible, restoresStock } from "@/lib/orders/transitions";
import { UTR_REGEX, normalizeUtr } from "@/lib/upi";
import { logAudit } from "@/server/audit";
import { couponUsageFor, toCouponRule } from "@/server/cart/service";
import { estimateDelivery } from "@/server/delivery";
import { effectiveUpi } from "@/server/payments/upi";
import { readSettings } from "@/server/settings";
import { sendOrderStatusEmail, sendPaymentReviewAlert } from "./emails";
import { nextInvoiceNumber, nextOrderNumber } from "./numbers";

type Tx = Prisma.TransactionClient;

export class CheckoutError extends Error {}
export class OutOfStockError extends CheckoutError {
  constructor(public productName: string) {
    super(`Sorry — ${productName} just sold out.`);
  }
}

// ───────────────────────── Quote ─────────────────────────

export type DeliveryOption = "STANDARD" | "EXPRESS";

export type QuoteLine = {
  productId: string;
  brandName: string;
  modelName: string;
  reference: string;
  sku: string;
  imageUrl: string | null;
  hsnCode: string;
  gstRatePct: number;
  mrp: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
};

export type Quote = {
  lines: QuoteLine[];
  totals: OrderTotals;
  coupon: { id: string; code: string; discount: number } | null;
  couponError: string | null;
  upi: { allowed: boolean; reason: string | null };
  express: { available: boolean; fee: number };
  delivery: { from: string; to: string; label: string } | null;
  address: Prisma.AddressGetPayload<object>;
};

export async function buildQuote(
  userId: string,
  input: { addressId: string; paymentMethod: PaymentMethod; deliveryOption: DeliveryOption },
): Promise<Quote> {
  const [settings, address, cart] = await Promise.all([
    readSettings(),
    db.address.findFirst({ where: { id: input.addressId, userId } }),
    db.cart.findUnique({
      where: { userId },
      include: {
        items: {
          where: { savedForLater: false },
          include: {
            product: {
              select: {
                id: true, modelName: true, referenceNumber: true, sku: true, mrp: true, sellingPrice: true, stock: true, status: true,
                deletedAt: true, hsnCode: true, gstRatePct: true, brand: { select: { name: true } },
                images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!address) throw new CheckoutError("Please choose a delivery address.");
  if (!cart || cart.items.length === 0) throw new CheckoutError("Your bag is empty.");
  if (!pinMatchesState(address.pincode, address.state)) throw new CheckoutError("The PIN code doesn't match the selected state. Please check the address.");

  const lines: QuoteLine[] = cart.items.map((i) => {
    const p = i.product;
    if (p.status !== "ACTIVE" || p.deletedAt) throw new CheckoutError(`${p.modelName} is no longer available. Please remove it from your bag.`);
    if (p.stock < i.quantity) throw new CheckoutError(p.stock === 0 ? `${p.modelName} has sold out.` : `Only ${p.stock} of ${p.modelName} available.`);
    return {
      productId: p.id, brandName: p.brand.name, modelName: p.modelName, reference: p.referenceNumber, sku: p.sku,
      imageUrl: p.images[0]?.url ?? null, hsnCode: p.hsnCode, gstRatePct: Number(p.gstRatePct), mrp: p.mrp,
      unitPrice: p.sellingPrice, quantity: i.quantity, lineTotal: p.sellingPrice * i.quantity, stock: p.stock,
    };
  });
  const itemsTotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;
  if (cart.couponCode) {
    const c = await db.coupon.findUnique({ where: { code: cart.couponCode } });
    const res = evaluateCoupon(c ? toCouponRule(c) : null, itemsTotal, c ? await couponUsageFor(c.id, userId) : 0);
    if (res.ok && c) coupon = { id: c.id, code: c.code, discount: res.discount };
    else if (!res.ok) couponError = res.reason;
  }

  const est = await estimateDelivery(address.pincode, settings.defaultDeliveryDays);
  if (est.ok && !est.serviceable) throw new CheckoutError("We can't deliver to this PIN code yet. Please choose another address.");

  const express = { available: settings.expressShippingFee !== null, fee: settings.expressShippingFee ?? 0 };
  const deliveryOption = input.deliveryOption === "EXPRESS" && express.available ? "EXPRESS" : "STANDARD";
  const baseShipping = computeShippingFee(itemsTotal, settings.shippingFee, settings.freeShippingThreshold);
  const shippingFee = baseShipping + (deliveryOption === "EXPRESS" ? express.fee : 0);

  const upiConfig = effectiveUpi(settings);
  const upi = { allowed: Boolean(upiConfig), reason: upiConfig ? null : "Payments are temporarily unavailable. Please try again a little later or contact us." };
  if (!upi.allowed) throw new CheckoutError(upi.reason!);

  const totals = computeOrderTotals({
    lines: lines.map((l) => ({ mrp: l.mrp, unitPrice: l.unitPrice, quantity: l.quantity, gstRatePct: l.gstRatePct })),
    couponDiscount: coupon?.discount ?? 0,
    shippingFee,
    freeShippingThreshold: null, // already applied above
    sellerStateCode: settings.stateCode,
    shipStateCode: address.state,
  });

  return {
    lines, totals, coupon, couponError, upi, express,
    delivery: est.ok ? { from: est.from, to: est.to, label: est.label } : null,
    address,
  };
}

// ───────────────────────── Stock ─────────────────────────

/** Product pages are ISR-cached; refresh the ones whose stock just changed. */
export async function revalidateStock(productIds: string[]) {
  if (!productIds.length) return;
  try {
    const rows = await db.product.findMany({ where: { id: { in: productIds } }, select: { slug: true } });
    for (const r of rows) revalidateTag(TAGS.product(r.slug), "max");
  } catch (e) {
    reportError(e, { where: "revalidateStock" });
  }
}

export async function decrementStock(tx: Tx, items: { productId: string; quantity: number; modelName: string }[]) {
  for (const it of items) {
    const n = await tx.$executeRaw`
      UPDATE "Product" SET "stock" = "stock" - ${it.quantity}, "soldCount" = "soldCount" + ${it.quantity}
      WHERE "id" = ${it.productId} AND "stock" >= ${it.quantity}`;
    if (n !== 1) throw new OutOfStockError(it.modelName);
  }
}

export async function restoreStock(tx: Tx, items: { productId: string; quantity: number }[]): Promise<string[]> {
  const restocked: string[] = [];
  for (const it of items) {
    const rows = await tx.$queryRaw<{ stock: number }[]>`
      UPDATE "Product" SET "stock" = "stock" + ${it.quantity}, "soldCount" = GREATEST("soldCount" - ${it.quantity}, 0)
      WHERE "id" = ${it.productId} RETURNING "stock"`;
    if (rows[0] && rows[0].stock - it.quantity <= 0) restocked.push(it.productId);
  }
  return restocked;
}

/** Emails everyone waiting for these products (called after stock goes from 0 to > 0). */
export async function notifyBackInStock(productIds: string[]) {
  for (const productId of productIds) {
    const product = await db.product.findUnique({ where: { id: productId }, select: { slug: true, modelName: true, stock: true, brand: { select: { name: true, slug: true } } } });
    if (!product || product.stock <= 0) continue;
    const alerts = await db.stockAlert.findMany({ where: { productId, notifiedAt: null }, take: 500 });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
    for (const a of alerts) {
      const res = await sendEmail({
        to: a.email,
        subject: `${product.brand.name} ${product.modelName} is back in stock`,
        tag: "stock.back",
        react: createElement(BackInStockEmail, { productName: `${product.brand.name} ${product.modelName}`, url: `${siteUrl}/watches/${product.brand.slug}/${product.slug}`, siteUrl }),
      });
      if (res.ok) await db.stockAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
    }
  }
}

// ───────────────────────── Place order ─────────────────────────

export type PlacedOrder = { orderId: string; orderNumber: string };

async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: true } });
}

/**
 * Creates the order and RESERVES stock immediately, so a watch can't be sold twice while a customer
 * is paying. Unpaid orders release their stock when `paymentDueAt` passes.
 */
export async function placeOrder(
  user: { id: string; email: string },
  input: { addressId: string; paymentMethod: PaymentMethod; deliveryOption: DeliveryOption; idempotencyKey: string },
): Promise<PlacedOrder> {
  // Idempotency: the same checkout attempt never creates two orders.
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.userId !== user.id) throw new CheckoutError("Invalid checkout session. Please refresh and try again.");
    return { orderId: existing.id, orderNumber: existing.orderNumber };
  }

  const q = await buildQuote(user.id, input);
  if (q.couponError) throw new CheckoutError(q.couponError);
  const settings = await readSettings();

  const order = await db.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: user.id,
        status: "PENDING_PAYMENT",
        paymentMethod: input.paymentMethod,
        deliveryOption: input.deliveryOption,
        idempotencyKey: input.idempotencyKey,
        paymentDueAt: new Date(Date.now() + settings.paymentWindowMinutes * 60_000),
        shipName: q.address.fullName,
        shipPhone: q.address.phone,
        shipLine1: q.address.line1,
        shipLine2: q.address.line2,
        shipLandmark: q.address.landmark,
        shipCity: q.address.city,
        shipState: q.address.state,
        shipPincode: q.address.pincode,
        ...q.totals,
        couponId: q.coupon?.id ?? null,
        couponCode: q.coupon?.code ?? null,
        items: {
          create: q.lines.map((l) => ({
            productId: l.productId, brandName: l.brandName, modelName: l.modelName, reference: l.reference, sku: l.sku,
            imageUrl: l.imageUrl, hsnCode: l.hsnCode, gstRatePct: l.gstRatePct, mrp: l.mrp, unitPrice: l.unitPrice,
            quantity: l.quantity, lineTotal: l.lineTotal,
          })),
        },
        events: {
          create: [{ toStatus: "PENDING_PAYMENT", note: `Awaiting UPI payment of ${formatINR(q.totals.grandTotal)}` }],
        },
      },
    });
    await decrementStock(tx, q.lines);
    await finalizeCouponAndCart(tx, created.id, user.id, q.coupon, q.lines.map((l) => l.productId));
    return created;
  });

  logger.info({ orderId: order.id, method: input.paymentMethod }, "order placed");
  void revalidateStock(q.lines.map((l) => l.productId));
  return { orderId: order.id, orderNumber: order.orderNumber };
}

async function finalizeCouponAndCart(tx: Tx, orderId: string, userId: string, coupon: { id: string; discount: number } | null, productIds: string[]) {
  if (coupon) {
    await tx.couponRedemption.create({ data: { couponId: coupon.id, userId, orderId, amount: coupon.discount } });
    await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
  }
  const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
  if (cart) {
    await tx.cartItem.deleteMany({ where: { cartId: cart.id, productId: { in: productIds }, savedForLater: false } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  }
}

/** A coupon used on an order that never got paid is given back to the customer. */
async function releaseCoupon(tx: Tx, orderId: string) {
  const red = await tx.couponRedemption.findUnique({ where: { orderId } });
  if (!red) return;
  await tx.couponRedemption.delete({ where: { orderId } });
  await tx.coupon.update({ where: { id: red.couponId }, data: { usedCount: { decrement: 1 } } });
}

// ───────────────────────── UPI payment (manual UTR verification) ─────────────────────────

export class DuplicateUtrError extends CheckoutError {
  constructor() {
    super("This UTR has already been submitted for another payment. Please check the 12-digit reference in your UPI app.");
  }
}

/** Customer says "I've paid": record the UTR and put the order into verification. */
export async function submitUtr(
  userId: string,
  orderId: string,
  input: { utr: string; payerVpa?: string | null; payerName?: string | null; screenshotUrl?: string | null; screenshotPublicId?: string | null },
) {
  const utr = normalizeUtr(input.utr);
  if (!UTR_REGEX.test(utr)) throw new CheckoutError("Enter the 12-digit UTR (UPI reference number) from your UPI app.");

  const res = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.userId !== userId) throw new CheckoutError("Order not found.");
    if (order.status === "PAYMENT_SUBMITTED") throw new CheckoutError("We've already received your payment details and are verifying them.");
    if (!awaitingPayment(order.status)) throw new CheckoutError("This order no longer needs payment.");
    const dupe = await tx.payment.findUnique({ where: { utr } });
    if (dupe) throw new DuplicateUtrError();
    await tx.payment.create({
      data: {
        orderId, utr, amountPaise: toPaise(order.grandTotal),
        payerVpa: input.payerVpa?.trim().toLowerCase() || null, payerName: input.payerName?.trim() || null,
        screenshotUrl: input.screenshotUrl ?? null, screenshotPublicId: input.screenshotPublicId ?? null,
      },
    });
    assertTransition(order.status, "PAYMENT_SUBMITTED");
    await tx.order.update({ where: { id: orderId }, data: { status: "PAYMENT_SUBMITTED" } });
    const ev = await tx.orderStatusEvent.create({ data: { orderId, fromStatus: order.status, toStatus: "PAYMENT_SUBMITTED", note: `UPI payment submitted · UTR ${utr}` } });
    return { eventId: ev.id };
  }).catch((e: unknown) => {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw new DuplicateUtrError();
    throw e;
  });

  void sendOrderStatusEmail(orderId, "PAYMENT_SUBMITTED", res.eventId).catch((e) => reportError(e));
  void sendPaymentReviewAlert(orderId, utr).catch((e) => reportError(e));
}

/** Admin found the UTR + amount in the bank/UPI statement. */
export async function confirmUpiPayment(paymentId: string, adminId: string) {
  const res = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new CheckoutError("Payment not found.");
    const order = await lockOrder(tx, payment.orderId);
    if (!["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAYMENT_FAILED"].includes(order.status)) {
      throw new CheckoutError(order.status === "CANCELLED" ? "This order was cancelled. Record a refund instead if the money was received." : "This order is already paid.");
    }
    await tx.payment.update({ where: { id: paymentId }, data: { status: "CONFIRMED", reviewedAt: new Date(), reviewedById: adminId, rejectReason: null } });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentDueAt: null, invoiceNumber: order.invoiceNumber ?? (await nextInvoiceNumber(tx)), invoicedAt: order.invoicedAt ?? new Date() },
    });
    const ev = await tx.orderStatusEvent.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: "PAID", note: `UPI payment verified · UTR ${payment.utr}`, actorId: adminId } });
    await logAudit({ tx, actorId: adminId, action: "payment.confirm", entityType: "Payment", entityId: paymentId, diff: { utr: [null, payment.utr], order: [order.status, "PAID"] } });
    return { orderId: order.id, eventId: ev.id };
  });
  void sendOrderStatusEmail(res.orderId, "PAID", res.eventId).catch((e) => reportError(e));
}

/** UTR not found / amount mismatch: the customer gets another payment window to resubmit. */
export async function rejectUpiPayment(paymentId: string, adminId: string, reason: string) {
  const settings = await readSettings();
  const res = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new CheckoutError("Payment not found.");
    if (payment.status !== "SUBMITTED") throw new CheckoutError("This payment has already been reviewed.");
    const order = await lockOrder(tx, payment.orderId);
    await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: adminId, rejectReason: reason } });
    let eventId: string | undefined;
    if (order.status === "PAYMENT_SUBMITTED") {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED", paymentDueAt: new Date(Date.now() + settings.paymentWindowMinutes * 60_000) } });
      eventId = (await tx.orderStatusEvent.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: "PAYMENT_FAILED", note: `We couldn't verify UTR ${payment.utr}: ${reason}`, actorId: adminId } })).id;
    }
    await logAudit({ tx, actorId: adminId, action: "payment.reject", entityType: "Payment", entityId: paymentId, diff: { utr: [null, payment.utr], reason: [null, reason] } });
    return { orderId: order.id, eventId };
  });
  if (res.eventId) void sendOrderStatusEmail(res.orderId, "PAYMENT_FAILED", res.eventId).catch((e) => reportError(e));
}

/**
 * Cancels UPI orders whose payment window passed without a UTR (or after a rejection), releasing
 * their stock and coupon. Orders with a submitted UTR are never auto-cancelled — they wait for review.
 */
export async function expireUnpaidOrders(limit = 50) {
  const due = await db.order.findMany({
    where: { status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] }, paymentDueAt: { lt: new Date() } },
    select: { id: true },
    take: limit,
  });
  for (const o of due) {
    try {
      await transitionOrder(o.id, "CANCELLED", { id: null, label: "system" }, { note: "Payment window expired — the watch has been released" });
    } catch (e) {
      reportError(e, { where: "expireUnpaidOrders", orderId: o.id });
    }
  }
  return due.length;
}

let lastExpirySweep = 0;
/** Cheap, throttled sweep called from busy endpoints so no external cron is required. */
export function sweepExpiredOrders() {
  if (Date.now() - lastExpirySweep < 60_000) return;
  lastExpirySweep = Date.now();
  void expireUnpaidOrders().catch((e) => reportError(e, { where: "sweepExpiredOrders" }));
}

// ───────────────────────── Transitions ─────────────────────────

export type TransitionExtra = { note?: string | null; courierName?: string | null; trackingNumber?: string | null; trackingUrl?: string | null };

export async function transitionOrder(orderId: string, to: OrderStatus, actor: { id: string | null; label: string }, extra: TransitionExtra = {}) {
  const { eventId, restocked, touched } = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    assertTransition(order.status, to);
    const restocked = restoresStock(order.status, to) ? await restoreStock(tx, order.items) : [];
    if (to === "CANCELLED" && (awaitingPayment(order.status) || order.status === "PAYMENT_SUBMITTED")) await releaseCoupon(tx, order.id);
    if (to === "CANCELLED") await tx.order.update({ where: { id: orderId }, data: { paymentDueAt: null } });
    const data: Prisma.OrderUpdateInput = { status: to };
    if (to === "DELIVERED") data.deliveredAt = new Date();
    if (to === "CANCELLED") { data.cancelledAt = new Date(); data.cancelReason = extra.note ?? null; }
    if (extra.courierName !== undefined && extra.courierName) data.courierName = extra.courierName;
    if (extra.trackingNumber !== undefined && extra.trackingNumber) data.trackingNumber = extra.trackingNumber;
    if (extra.trackingUrl !== undefined && extra.trackingUrl) data.trackingUrl = extra.trackingUrl;
    await tx.order.update({ where: { id: orderId }, data });
    const ev = await tx.orderStatusEvent.create({
      data: {
        orderId, fromStatus: order.status, toStatus: to, note: extra.note ?? null, actorId: actor.id,
        courierName: extra.courierName ?? order.courierName, trackingNumber: extra.trackingNumber ?? order.trackingNumber, trackingUrl: extra.trackingUrl ?? order.trackingUrl,
      },
    });
    if (actor.id) {
      await logAudit({ tx, actorId: actor.id, action: "order.status", entityType: "Order", entityId: orderId, diff: { status: [order.status, to], ...(extra.trackingNumber ? { trackingNumber: [order.trackingNumber, extra.trackingNumber] } : {}) } });
    }
    return { eventId: ev.id, restocked, touched: restoresStock(order.status, to) ? order.items.map((i) => i.productId) : [] };
  });
  void sendOrderStatusEmail(orderId, to, eventId).catch((e) => reportError(e));
  if (restocked.length) void notifyBackInStock(restocked).catch((e) => reportError(e));
  if (touched.length) void revalidateStock(touched);
}

/**
 * Records a refund. There's no gateway: the store sends the money back by UPI/bank transfer and
 * enters the transfer reference (UTR). Without a reference the refund is logged as PENDING.
 * amount=null → full remaining amount.
 */
export async function issueRefund(orderId: string, amount: number | null, reason: string, actorId: string | null = null, reference: string | null = null) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, refunds: true } });
  const refunded = order.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amount, 0);
  const remaining = order.grandTotal - refunded;
  const value = amount ?? remaining;
  if (value <= 0 || value > remaining) throw new CheckoutError(`Refund must be between ₹1 and ₹${remaining.toLocaleString("en-IN")}.`);

  const confirmed = order.payments.find((p) => p.status === "CONFIRMED" || p.status === "PARTIALLY_REFUNDED");
  if (confirmed) {
    await db.payment.update({ where: { id: confirmed.id }, data: { status: value === remaining && refunded === 0 ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  }
  const ref = reference?.trim() || null;
  await db.refund.create({ data: { orderId, reference: ref, amount: value, status: ref ? "PROCESSED" : "PENDING", reason } });
  if (actorId) await logAudit({ actorId, action: "order.refund", entityType: "Order", entityId: orderId, diff: { amount: [null, value], reference: [null, ref], reason: [null, reason] } });

  const fullyRefunded = refunded + value >= order.grandTotal;
  if (ref && fullyRefunded && (order.status === "CANCELLED" || order.status === "RETURNED")) {
    await transitionOrder(orderId, "REFUNDED", { id: actorId, label: actorId ? "admin" : "system" }, { note: `${reason} · refund reference ${ref}` });
  }
}

/** Marks a pending refund as sent, with the transfer reference. */
export async function completeRefund(refundId: string, reference: string, actorId: string) {
  const r = await db.refund.update({ where: { id: refundId }, data: { reference: reference.trim(), status: "PROCESSED" }, include: { order: { include: { refunds: true } } } });
  await logAudit({ actorId, action: "order.refund.complete", entityType: "Refund", entityId: refundId, diff: { reference: [null, reference] } });
  const done = r.order.refunds.filter((x) => x.status === "PROCESSED").reduce((s, x) => s + x.amount, 0);
  if (done >= r.order.grandTotal && (r.order.status === "CANCELLED" || r.order.status === "RETURNED")) {
    await transitionOrder(r.orderId, "REFUNDED", { id: actorId, label: "admin" }, { note: `Refund sent · reference ${reference}` });
  }
}

// ───────────────────────── Customer actions ─────────────────────────

export async function cancelByCustomer(userId: string, orderId: string, reason: string) {
  const order = await db.order.findFirst({ where: { id: orderId, userId }, include: { payments: true } });
  if (!order) throw new CheckoutError("Order not found.");
  if (!isCustomerCancellable(order.status)) throw new CheckoutError("This order has already shipped and can no longer be cancelled. You can request a return after delivery.");
  const moneyMayHaveArrived = ["PAYMENT_SUBMITTED", "PAID", "PROCESSING"].includes(order.status);
  await transitionOrder(orderId, "CANCELLED", { id: null, label: "customer" }, { note: `Cancelled by customer: ${reason}` });
  // Logged as a pending refund; the store sends it back to the customer's UPI and records the reference.
  if (moneyMayHaveArrived) {
    await issueRefund(orderId, null, order.status === "PAYMENT_SUBMITTED" ? "Customer cancelled while payment was being verified — refund once receipt is confirmed" : "Customer cancellation");
  }
}

export async function requestReturnByCustomer(userId: string, orderId: string, input: { type: "RETURN" | "EXCHANGE"; reason: string; details?: string }) {
  const order = await db.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new CheckoutError("Order not found.");
  const settings = await readSettings();
  if (!isReturnEligible(order.status, order.deliveredAt, settings.returnWindowDays))
    throw new CheckoutError(`Returns are accepted within ${settings.returnWindowDays} days of delivery.`);
  await db.returnRequest.create({ data: { orderId, type: input.type, reason: input.reason, details: input.details } });
  await transitionOrder(orderId, "RETURN_REQUESTED", { id: null, label: "customer" }, { note: `${input.type === "EXCHANGE" ? "Exchange" : "Return"} requested: ${input.reason}` });
}

import "server-only";
import { createElement } from "react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { OrderStatusEmail } from "@/lib/email/templates/order-status";
import { formatINR } from "@/lib/money";
import { readSettings } from "@/server/settings";

const COPY: Partial<Record<OrderStatus, { subject: string; headline: string; message: (n: string) => string }>> = {
  PAYMENT_SUBMITTED: { subject: "Payment details received", headline: "We're verifying your payment", message: () => "Thank you — we've received your UPI payment details. Our team verifies every payment by hand, usually within a few hours during business hours. We'll email you as soon as it's confirmed; your watch is reserved for you meanwhile." },
  PAID: { subject: "Payment confirmed — order confirmed", headline: "Payment confirmed — thank you", message: () => "We've verified your payment. Our specialists are now inspecting and preparing your watch with care." },
  PROCESSING: { subject: "Your order is being prepared", headline: "We're preparing your watch", message: () => "Your watch is being authenticated, regulated and packed in its presentation box." },
  SHIPPED: { subject: "Your order has shipped", headline: "Your watch is on its way", message: () => "Your parcel has left our boutique, fully insured. A signature will be required on delivery." },
  OUT_FOR_DELIVERY: { subject: "Out for delivery today", headline: "Arriving today", message: () => "Your parcel is out for delivery. Please keep a photo ID handy — a signature is required." },
  DELIVERED: { subject: "Delivered — enjoy your watch", headline: "Delivered", message: () => "We hope it brings you joy for many years. If you have a moment, we'd love your review." },
  CANCELLED: { subject: "Your order has been cancelled", headline: "Order cancelled", message: () => "Your order has been cancelled. If you had already paid by UPI, we'll refund the full amount to the same UPI account and email you the reference." },
  PAYMENT_FAILED: { subject: "Action needed: we couldn't verify your payment", headline: "We couldn't verify your payment", message: () => "We couldn't match the UPI reference you submitted with a payment received. Please check the 12-digit UTR in your UPI app and submit it again from your order page — your watch stays reserved for a little longer. If money left your account, reply to this email and we'll sort it out." },
  RETURN_REQUESTED: { subject: "Return request received", headline: "We've received your return request", message: () => "Our client services team will contact you within one business day to arrange an insured pickup." },
  RETURNED: { subject: "Return received", headline: "Your return has arrived", message: () => "We've received and inspected your return. Your refund is being processed." },
  REFUNDED: { subject: "Refund processed", headline: "Your refund has been sent", message: () => "Your refund has been sent to your UPI / bank account. UPI refunds usually arrive within minutes; bank transfers can take up to 2 business days." },
};

/** Emails the customer about a status change (respecting nothing optional — these are transactional). */
export async function sendOrderStatusEmail(orderId: string, status: OrderStatus, eventId?: string) {
  const copy = COPY[status];
  if (!copy) return;
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true, name: true } }, items: true },
  });
  if (!order?.user.email) return;
  const settings = await readSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  const res = await sendEmail({
    to: order.user.email,
    subject: `${copy.subject} · ${order.orderNumber}`,
    tag: `order.${status.toLowerCase()}`,
    react: createElement(OrderStatusEmail, {
      orderNumber: order.orderNumber,
      customerName: order.shipName.split(" ")[0] || order.user.name || "Client",
      status,
      headline: copy.headline,
      message: copy.message(order.orderNumber),
      items: order.items.map((i) => ({ name: `${i.brandName} ${i.modelName}`, quantity: i.quantity, lineTotal: formatINR(i.lineTotal) })),
      total: formatINR(order.grandTotal),
      orderUrl: `${siteUrl}/account/orders/${order.id}`,
      tracking: order.trackingNumber ? { courier: order.courierName, number: order.trackingNumber, url: order.trackingUrl } : null,
      siteUrl,
      storeName: settings.storeName,
    }),
  });
  if (res.ok && eventId) await db.orderStatusEvent.update({ where: { id: eventId }, data: { emailSentAt: new Date() } });
}

/** Tells the store (contact email) a UTR is waiting for verification. */
export async function sendPaymentReviewAlert(orderId: string, utr: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: { select: { email: true } } } });
  if (!order) return;
  const settings = await readSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  await sendEmail({
    to: settings.contactEmail,
    subject: `Verify UPI payment · ${order.orderNumber} · ${formatINR(order.grandTotal)}`,
    tag: "admin.payment-review",
    react: createElement(OrderStatusEmail, {
      orderNumber: order.orderNumber,
      customerName: "team",
      status: "PAYMENT_SUBMITTED",
      headline: `UTR ${utr} — please verify`,
      message: `${order.shipName} (${order.user.email}) submitted UPI reference ${utr} for ${formatINR(order.grandTotal)}. Check it in your bank / UPI business app, then confirm or reject it in Admin → Payments.`,
      items: [],
      total: formatINR(order.grandTotal),
      orderUrl: `${siteUrl}/admin/payments`,
      siteUrl,
      storeName: settings.storeName,
    }),
  });
}

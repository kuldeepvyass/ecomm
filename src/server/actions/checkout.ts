"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { VPA_REGEX } from "@/lib/upi";
import { CheckoutError, buildQuote, placeOrder, submitUtr, type PlacedOrder, type Quote } from "@/server/orders/service";
import { ok, runAction, UserFacingError, type ActionResult } from "./result";

const base = z.object({
  addressId: z.string().cuid("Choose a delivery address"),
  paymentMethod: z.literal("UPI").default("UPI"),
  deliveryOption: z.enum(["STANDARD", "EXPRESS"]).default("STANDARD"),
});

function wrapCheckout<T>(fn: () => Promise<T>) {
  return runAction<T>(async () => {
    try {
      return ok(await fn());
    } catch (e) {
      if (e instanceof CheckoutError) throw new UserFacingError(e.message);
      throw e;
    }
  });
}

export type QuoteView = Omit<Quote, "address" | "lines"> & { lines: Omit<Quote["lines"][number], "stock">[] };

export async function getQuote(input: z.input<typeof base>): Promise<ActionResult<QuoteView>> {
  return wrapCheckout(async () => {
    const user = await assertUser();
    const q = await buildQuote(user.id, base.parse(input));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { address, ...rest } = q;
    return { ...rest, lines: q.lines.map(({ stock: _s, ...l }) => l) };
  });
}

export async function submitOrder(input: z.input<typeof base> & { idempotencyKey: string }): Promise<ActionResult<PlacedOrder>> {
  return wrapCheckout(async () => {
    const user = await assertUser();
    await enforceRateLimit("checkout", user.id, 10, 600);
    const data = base.extend({ idempotencyKey: z.string().uuid() }).parse(input);
    return placeOrder({ id: user.id, email: user.email ?? "" }, data);
  });
}

const utrSchema = z.object({
  orderId: z.string().cuid(),
  utr: z.string().trim().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^\d{12}$/, "The UTR is the 12-digit number shown in your UPI app")),
  payerVpa: z.union([z.literal(""), z.string().trim().regex(VPA_REGEX, "That doesn't look like a UPI ID (e.g. name@okaxis)")]).optional(),
  payerName: z.string().trim().max(80).optional(),
  screenshot: z.object({ url: z.string().max(600), publicId: z.string().max(300).optional() }).nullable().optional(),
});

/** "I've paid" — records the customer's UTR for manual verification. */
export async function submitPaymentUtr(input: z.input<typeof utrSchema>): Promise<ActionResult<null>> {
  return wrapCheckout(async () => {
    const user = await assertUser();
    await enforceRateLimit("utr", user.id, 10, 3600);
    const d = utrSchema.parse(input);
    if (d.screenshot && !(d.screenshot.url.startsWith("/uploads/payments/") || d.screenshot.url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`))) {
      throw new CheckoutError("Invalid screenshot.");
    }
    await submitUtr(user.id, d.orderId, {
      utr: d.utr, payerVpa: d.payerVpa || null, payerName: d.payerName || null,
      screenshotUrl: d.screenshot?.url ?? null, screenshotPublicId: d.screenshot?.publicId ?? null,
    });
    return null;
  });
}

/** Lets the pay page poll whether the store has verified the payment yet. */
export async function getPaymentState(orderId: string): Promise<ActionResult<{ status: string }>> {
  return wrapCheckout(async () => {
    const user = await assertUser();
    const o = await db.order.findFirst({ where: { id: z.string().cuid().parse(orderId), userId: user.id }, select: { status: true } });
    if (!o) throw new CheckoutError("Order not found.");
    return { status: o.status };
  });
}

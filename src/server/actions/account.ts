"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/india";
import { assertUser } from "@/lib/session";
import { sanitizeText } from "@/lib/text";
import { enforceRateLimit } from "@/lib/rate-limit";
import { IFSC_REGEX, bankDetailsSchema, type BankDetails } from "@/lib/validation/bank";
import { CheckoutError, cancelByCustomer, requestReturnByCustomer, setRefundBankDetails } from "@/server/orders/service";
import { addToBag } from "./cart";
import { ok, runAction, UserFacingError, type ActionResult } from "./result";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().transform(normalizeMobile).pipe(z.union([z.literal(""), z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")])),
});

export async function updateProfile(_: unknown, form: FormData): Promise<ActionResult<null>> {
  return runAction<null>(async () => {
    const user = await assertUser();
    const data = profileSchema.parse({ name: form.get("name"), phone: form.get("phone") ?? "" });
    await db.user.update({ where: { id: user.id }, data: { name: sanitizeText(data.name, 80), phone: data.phone || null } });
    revalidatePath("/account");
    return ok(null, "Profile updated");
  });
}

const prefsSchema = z.object({ notifyMarketing: z.boolean(), notifyBackInStock: z.boolean() });

export async function updateNotificationPrefs(input: z.input<typeof prefsSchema>): Promise<ActionResult<null>> {
  return runAction<null>(async () => {
    const user = await assertUser();
    const data = prefsSchema.parse(input);
    await db.user.update({ where: { id: user.id }, data });
    return ok(null, "Preferences saved");
  });
}

function wrap<T>(fn: () => Promise<T>) {
  return runAction<T>(async () => {
    try {
      return ok(await fn());
    } catch (e) {
      if (e instanceof CheckoutError) throw new UserFacingError(e.message);
      throw e;
    }
  });
}

/** Bank details arrive as plain fields; names are sanitised before storage. */
function parseBank(input: unknown): BankDetails {
  const b = bankDetailsSchema.parse(input);
  return { ...b, accountHolder: sanitizeText(b.accountHolder, 80), bankName: sanitizeText(b.bankName, 80), bankBranch: b.bankBranch ? sanitizeText(b.bankBranch, 120) : undefined };
}

export async function cancelMyOrder(orderId: string, reason: string, bank?: unknown): Promise<ActionResult<null>> {
  return wrap(async () => {
    const user = await assertUser();
    await enforceRateLimit("order-cancel", user.id, 10, 60 * 60);
    await cancelByCustomer(user.id, z.string().cuid().parse(orderId), sanitizeText(z.string().min(2, "Tell us why").max(300).parse(reason), 300), bank ? parseBank(bank) : null);
    revalidatePath(`/account/orders/${orderId}`);
    return null;
  });
}

/** Customer adds/corrects the account for a refund the store has logged. */
export async function saveRefundBankDetails(orderId: string, bank: unknown): Promise<ActionResult<null>> {
  return wrap(async () => {
    const user = await assertUser();
    await enforceRateLimit("refund-bank", user.id, 10, 60 * 60);
    await setRefundBankDetails(user.id, z.string().cuid().parse(orderId), parseBank(bank));
    revalidatePath(`/account/orders/${orderId}`);
    return null;
  });
}

/**
 * IFSC → bank and branch, via Razorpay's free public IFSC directory (no key, no customer data sent —
 * only the IFSC). Returns null when unknown or unreachable; the customer can still type the bank name.
 */
export async function lookupIfsc(ifsc: string): Promise<{ bank: string; branch: string } | null> {
  const code = String(ifsc ?? "").trim().toUpperCase();
  if (!IFSC_REGEX.test(code)) return null;
  await assertUser();
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${code}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { BANK?: string; BRANCH?: string; CITY?: string };
    return j.BANK ? { bank: j.BANK, branch: [j.BRANCH, j.CITY].filter(Boolean).join(", ") } : null;
  } catch {
    return null;
  }
}

const returnSchema = z.object({
  orderId: z.string().cuid(),
  type: z.enum(["RETURN", "EXCHANGE"]),
  reason: z.string().trim().min(3, "Choose a reason").max(120),
  details: z.string().trim().max(1000).optional(),
});

export async function requestReturn(input: z.input<typeof returnSchema>): Promise<ActionResult<null>> {
  return wrap(async () => {
    const user = await assertUser();
    const d = returnSchema.parse(input);
    await requestReturnByCustomer(user.id, d.orderId, { type: d.type, reason: sanitizeText(d.reason, 120), details: d.details ? sanitizeText(d.details, 1000) : undefined });
    revalidatePath(`/account/orders/${d.orderId}`);
    return null;
  });
}

export async function reorder(orderId: string): Promise<ActionResult<{ added: number; skipped: string[] }>> {
  return runAction<{ added: number; skipped: string[] }>(async () => {
    const user = await assertUser();
    const order = await db.order.findFirst({ where: { id: z.string().cuid().parse(orderId), userId: user.id }, include: { items: true } });
    if (!order) throw new UserFacingError("Order not found.");
    let added = 0;
    const skipped: string[] = [];
    for (const it of order.items) {
      const res = await addToBag(it.productId, it.quantity);
      if (res.ok) added++;
      else skipped.push(it.modelName);
    }
    return ok({ added, skipped });
  });
}

/**
 * Deletes the account: personal data is erased, orders are retained (anonymised)
 * because GST law requires invoices to be kept for 6+ years.
 */
export async function deleteMyAccount(_: unknown, form: FormData): Promise<ActionResult<null>> {
  const res = await runAction<null>(async () => {
    const user = await assertUser();
    if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") throw new UserFacingError('Type "DELETE" to confirm.');
    const active = await db.order.count({ where: { userId: user.id, status: { in: ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "RETURN_REQUESTED"] } } });
    if (active > 0) throw new UserFacingError("You have orders in progress. Please wait until they're delivered or cancelled.");
    await db.$transaction([
      db.address.deleteMany({ where: { userId: user.id } }),
      db.wishlistItem.deleteMany({ where: { userId: user.id } }),
      db.cart.deleteMany({ where: { userId: user.id } }),
      db.stockAlert.deleteMany({ where: { userId: user.id } }),
      db.account.deleteMany({ where: { userId: user.id } }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.review.updateMany({ where: { userId: user.id }, data: { authorName: "Former client" } }),
      db.user.update({
        where: { id: user.id },
        data: { email: `deleted-${user.id}@deleted.invalid`, name: null, phone: null, image: null, deletedAt: new Date(), notifyMarketing: false, notifyBackInStock: false },
      }),
    ]);
    return ok(null);
  });
  if (!res.ok) return res;
  await signOut({ redirect: false });
  redirect("/?account=deleted");
}

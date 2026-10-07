"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";
import { STATE_CODES } from "@/lib/india";
import { VPA_REGEX } from "@/lib/upi";
import { assertAdmin } from "@/lib/session";
import { sanitizeText, slugify } from "@/lib/text";
import { diffObjects, logAudit } from "@/server/audit";
import { revalidateCatalog } from "@/server/catalog/admin";
import { recomputeRating } from "@/server/reviews/queries";
import { ok, runAction, UserFacingError, type ActionResult } from "../result";

// ───────── Customers ─────────
export async function setCustomerBlocked(userId: string, blocked: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const id = z.string().cuid().parse(userId);
    if (id === admin.id) throw new UserFacingError("You can't block yourself.");
    await db.$transaction([
      db.user.update({ where: { id }, data: { blockedAt: blocked ? new Date() : null } }),
      ...(blocked ? [db.session.deleteMany({ where: { userId: id } })] : []),
    ]);
    await logAudit({ actorId: admin.id, action: blocked ? "customer.block" : "customer.unblock", entityType: "User", entityId: id });
    revalidatePath(`/admin/customers/${id}`);
    return ok(null, blocked ? "Customer blocked and signed out" : "Customer unblocked");
  });
}

// ───────── Reviews ─────────
export async function moderateReview(reviewId: string, decision: "APPROVED" | "REJECTED" | "DELETE", reply?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const id = z.string().cuid().parse(reviewId);
    const r = await db.review.findUnique({ where: { id }, select: { productId: true, status: true, product: { select: { slug: true } } } });
    if (!r) throw new UserFacingError("Review not found.");
    await db.$transaction(async (tx) => {
      if (decision === "DELETE") await tx.review.delete({ where: { id } });
      else await tx.review.update({ where: { id }, data: { status: decision, ...(reply !== undefined ? { storeReply: reply.trim() ? sanitizeText(reply, 2000) : null, storeRepliedAt: reply.trim() ? new Date() : null } : {}) } });
      await recomputeRating(tx, r.productId);
    });
    await logAudit({ actorId: admin.id, action: `review.${decision.toLowerCase()}`, entityType: "Review", entityId: id, diff: { status: [r.status, decision] } });
    revalidateTag(TAGS.reviews(r.productId), "max");
    revalidateCatalog([r.product.slug]);
    return ok(null, decision === "DELETE" ? "Review deleted" : decision === "APPROVED" ? "Review published" : "Review rejected");
  });
}

export async function replyToReview(reviewId: string, reply: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const id = z.string().cuid().parse(reviewId);
    const text = z.string().max(2000).parse(reply);
    const r = await db.review.update({ where: { id }, data: { storeReply: text.trim() ? sanitizeText(text, 2000) : null, storeRepliedAt: text.trim() ? new Date() : null }, select: { productId: true } });
    await logAudit({ actorId: admin.id, action: "review.reply", entityType: "Review", entityId: id });
    revalidateTag(TAGS.reviews(r.productId), "max");
    return ok(null, "Reply saved");
  });
}

// ───────── Coupons ─────────
const couponSchema = z.object({
  id: z.string().cuid().optional(),
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only").transform((s) => s.toUpperCase()),
  description: z.string().trim().max(200).optional().transform((v) => v || null),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.coerce.number().positive("Value must be positive").max(10_000_000),
  maxDiscount: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  minOrderValue: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0)),
  startsAt: z.preprocess((v) => (v ? new Date(String(v)) : null), z.date().nullable()),
  expiresAt: z.preprocess((v) => (v ? new Date(String(v)) : null), z.date().nullable()),
  usageLimit: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  perUserLimit: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  active: z.boolean(),
}).refine((c) => c.type !== "PERCENT" || c.value <= 100, { message: "Percent must be ≤ 100", path: ["value"] })
  .refine((c) => !c.startsAt || !c.expiresAt || c.startsAt < c.expiresAt, { message: "Expiry must be after start", path: ["expiresAt"] });

export async function saveCoupon(input: z.input<typeof couponSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const { id, ...d } = couponSchema.parse(input);
    const clash = await db.coupon.findUnique({ where: { code: d.code } });
    if (clash && clash.id !== id) throw new UserFacingError(`Code ${d.code} already exists.`);
    const c = id ? await db.coupon.update({ where: { id }, data: d }) : await db.coupon.create({ data: d });
    await logAudit({ actorId: admin.id, action: id ? "coupon.update" : "coupon.create", entityType: "Coupon", entityId: c.id, diff: { code: [null, c.code], active: [null, c.active] } });
    revalidatePath("/admin/coupons");
    return ok({ id: c.id }, "Coupon saved");
  });
}

export async function deleteCoupon(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const c = await db.coupon.findUnique({ where: { id: z.string().cuid().parse(id) }, include: { _count: { select: { orders: true } } } });
    if (!c) throw new UserFacingError("Coupon not found.");
    if (c._count.orders > 0) await db.coupon.update({ where: { id }, data: { active: false } });
    else await db.coupon.delete({ where: { id } });
    await logAudit({ actorId: admin.id, action: "coupon.delete", entityType: "Coupon", entityId: id, diff: { code: [c.code, null] } });
    revalidatePath("/admin/coupons");
    return ok(null, c._count.orders > 0 ? "Coupon has orders — deactivated instead" : "Coupon deleted");
  });
}

// ───────── Homepage content ─────────
const bannerSchema = z.object({
  id: z.string().cuid().optional(),
  placement: z.enum(["HERO", "STRIP", "STORY", "SHOP_BY"]),
  eyebrow: z.string().trim().max(60).optional().transform((v) => v || null),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(300).optional().transform((v) => v || null),
  imageUrl: z.string().trim().min(1, "Upload an image").max(600),
  mobileImageUrl: z.string().trim().max(600).optional().transform((v) => v || null),
  videoUrl: z.union([z.literal(""), z.string().url().max(600)]).optional().transform((v) => v || null),
  ctaLabel: z.string().trim().max(40).optional().transform((v) => v || null),
  ctaHref: z.string().trim().max(300).regex(/^(\/|https:\/\/)/, "Link must start with / or https://").optional().or(z.literal("")).transform((v) => v || null),
  position: z.coerce.number().int().min(0).max(100),
  active: z.boolean(),
});

export async function saveBanner(input: z.input<typeof bannerSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const { id, ...d } = bannerSchema.parse(input);
    const b = id ? await db.homeBanner.update({ where: { id }, data: d }) : await db.homeBanner.create({ data: d });
    await logAudit({ actorId: admin.id, action: id ? "banner.update" : "banner.create", entityType: "HomeBanner", entityId: b.id });
    revalidateTag(TAGS.home, "max");
    return ok({ id: b.id }, "Banner saved");
  });
}

export async function deleteBanner(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    await db.homeBanner.delete({ where: { id: z.string().cuid().parse(id) } });
    await logAudit({ actorId: admin.id, action: "banner.delete", entityType: "HomeBanner", entityId: id });
    revalidateTag(TAGS.home, "max");
    return ok(null, "Banner deleted");
  });
}

const collectionSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).optional().transform((v) => v || null),
  heroImage: z.string().trim().max(600).optional().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  showOnHome: z.boolean(),
});

export async function saveCollection(input: z.input<typeof collectionSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const { id, ...d } = collectionSchema.parse(input);
    const c = id ? await db.collection.update({ where: { id }, data: d }) : await db.collection.create({ data: { ...d, slug: slugify(d.name) } });
    await logAudit({ actorId: admin.id, action: id ? "collection.update" : "collection.create", entityType: "Collection", entityId: c.id });
    revalidateCatalog();
    return ok({ id: c.id }, "Collection saved");
  });
}

// ───────── Store settings ─────────
const optInt = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(100_000_000).nullable());
const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(60),
  logoUrl: z.string().trim().max(600).optional().transform((v) => v || null),
  contactEmail: z.email(),
  contactPhone: z.string().trim().min(6).max(20),
  whatsappNumber: z.string().trim().max(20).optional().transform((v) => (v ? v.replace(/[^\d+]/g, "") : null)),
  addressLine: z.string().trim().min(5).max(300),
  gstin: z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN").optional().or(z.literal("")).transform((v) => v || null),
  stateCode: z.enum(STATE_CODES),
  returnWindowDays: z.coerce.number().int().min(0).max(90),
  shippingFee: z.coerce.number().int().min(0).max(100_000),
  freeShippingThreshold: optInt,
  expressShippingFee: optInt,
  defaultDeliveryDays: z.coerce.number().int().min(1).max(30),
  upiVpa: z.union([z.literal(""), z.string().trim().regex(VPA_REGEX, "Enter a valid UPI ID, e.g. yourshop@okhdfcbank")]).optional().transform((v) => (v ? v.toLowerCase() : null)),
  upiPayeeName: z.string().trim().max(50).optional().transform((v) => v || null),
  paymentWindowMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours"),
});

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const d = settingsSchema.parse(input);
    const before = await db.storeSettings.findUnique({ where: { id: 1 } });
    await db.storeSettings.upsert({ where: { id: 1 }, create: { id: 1, ...d }, update: d });
    await logAudit({ actorId: admin.id, action: "settings.update", entityType: "StoreSettings", entityId: "1", diff: before ? (diffObjects(before as unknown as Record<string, unknown>, d) as object) : undefined });
    revalidateTag(TAGS.settings, "max");
    revalidatePath("/", "layout");
    return ok(null, "Settings saved");
  });
}

/**
 * Removes all sample (isDemo) data in one go. Demo products that appear in real orders are
 * soft-deleted instead (order history must stay intact); everything else is removed permanently.
 */
export async function deleteAllSampleData(confirmText: string): Promise<ActionResult<{ products: number; reviews: number; brands: number }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    if (confirmText.trim().toUpperCase() !== "DELETE SAMPLE DATA") throw new UserFacingError('Type "DELETE SAMPLE DATA" to confirm.');
    const result = await db.$transaction(async (tx) => {
      const reviews = await tx.review.deleteMany({ where: { OR: [{ isDemo: true }, { product: { isDemo: true } }] } });
      const demo = await tx.product.findMany({ where: { isDemo: true }, select: { id: true, _count: { select: { orderItems: true } } } });
      const withOrders = demo.filter((p) => p._count.orderItems > 0).map((p) => p.id);
      const without = demo.filter((p) => p._count.orderItems === 0).map((p) => p.id);
      await tx.cartItem.deleteMany({ where: { productId: { in: demo.map((p) => p.id) } } });
      await tx.product.deleteMany({ where: { id: { in: without } } });
      await tx.product.updateMany({ where: { id: { in: withOrders } }, data: { deletedAt: new Date(), status: "DRAFT", externalRating: null, externalRatingCount: null, externalRatingSource: null } });
      const brands = await tx.brand.deleteMany({ where: { isDemo: true, products: { none: {} } } });
      await tx.brand.updateMany({ where: { isDemo: true }, data: { isDemo: false } });
      return { products: demo.length, reviews: reviews.count, brands: brands.count };
    }, { timeout: 60_000 });
    await logAudit({ actorId: admin.id, action: "demo.purge", entityType: "Product", diff: { products: [result.products, 0], reviews: [result.reviews, 0] } });
    revalidateCatalog();
    revalidatePath("/", "layout");
    return ok(result, `Removed ${result.products} sample products, ${result.reviews} reviews and ${result.brands} brands`);
  });
}

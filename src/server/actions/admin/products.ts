"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/session";
import { diffObjects, logAudit } from "@/server/audit";
import { productInputSchema, revalidateCatalog, writeProduct } from "@/server/catalog/admin";
import { notifyBackInStock } from "@/server/orders/service";
import { deleteStoredImage } from "@/server/uploads";
import { ok, runAction, UserFacingError, type ActionResult } from "../result";

const imageSchema = z.object({
  url: z.string().min(1).max(600),
  publicId: z.string().max(300).nullable().optional(),
  alt: z.string().max(200).nullable().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataUrl: z.string().max(4000).nullable().optional(),
});

export async function saveProduct(input: { id?: string; product: unknown; images: unknown[] }): Promise<ActionResult<{ id: string; slug: string; brandSlug: string }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const data = productInputSchema.parse(input.product);
    const images = z.array(imageSchema).max(12).parse(input.images);
    const dupe = await db.product.findUnique({ where: { sku: data.sku }, select: { id: true } });
    if (dupe && dupe.id !== input.id) throw new UserFacingError(`SKU ${data.sku} is already used by another product.`);
    const before = input.id ? await db.product.findUnique({ where: { id: input.id }, include: { images: true } }) : null;
    if (input.id && !before) throw new UserFacingError("Product not found.");

    const res = await db.$transaction((tx) => writeProduct(tx, { id: input.id, input: data, images, actorId: admin.id }));
    const removed = (before?.images ?? []).filter((old) => !images.some((n) => n.url === old.url));
    await Promise.all(removed.map((im) => deleteStoredImage(im.publicId)));
    await logAudit({
      actorId: admin.id, action: res.created ? "product.create" : "product.update", entityType: "Product", entityId: res.product.id,
      diff: before ? diffObjects(before as unknown as Record<string, unknown>, res.product as unknown as Record<string, unknown>) as object : { sku: [null, data.sku] },
    });
    if (res.restocked) void notifyBackInStock([res.product.id]);
    const brand = await db.brand.findUniqueOrThrow({ where: { id: res.product.brandId }, select: { slug: true } });
    revalidateCatalog([res.product.slug, ...(before && before.slug !== res.product.slug ? [before.slug] : [])]);
    return ok({ id: res.product.id, slug: res.product.slug, brandSlug: brand.slug }, res.created ? "Product created" : "Product saved");
  });
}

export async function duplicateProduct(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const p = await db.product.findUnique({ where: { id: z.string().cuid().parse(id) }, include: { images: true, collections: true } });
    if (!p) throw new UserFacingError("Product not found.");
    const suffix = Date.now().toString(36).toUpperCase();
    const copy = await db.product.create({
      data: {
        ...Object.fromEntries(Object.entries(p).filter(([k]) => !["id", "images", "collections", "createdAt", "updatedAt", "ratingAvg", "ratingCount", "ratingDist", "viewCount", "soldCount", "deletedAt"].includes(k))),
        sku: `${p.sku}-COPY-${suffix}`.slice(0, 64),
        slug: `${p.slug}-copy-${suffix.toLowerCase()}`,
        referenceNumber: `${p.referenceNumber}-COPY-${suffix}`.slice(0, 64),
        modelName: `${p.modelName} (copy)`,
        status: "DRAFT",
        isDemo: false,
        externalRating: null, externalRatingCount: null, externalRatingSource: null,
        images: { create: p.images.map(({ url, alt, width, height, blurDataUrl, position }) => ({ url, publicId: null, alt, width, height, blurDataUrl, position })) },
        collections: { create: p.collections.map(({ collectionId, position }) => ({ collectionId, position })) },
      } as never,
    });
    await logAudit({ actorId: admin.id, action: "product.duplicate", entityType: "Product", entityId: copy.id, diff: { from: [null, p.id] } });
    revalidateCatalog();
    return ok({ id: copy.id }, "Duplicated as a draft");
  });
}

const ids = z.array(z.string().cuid()).min(1).max(1000);

export async function bulkProductAction(productIds: string[], action: "activate" | "deactivate" | "delete" | "restore" | "feature" | "unfeature"): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const list = ids.parse(productIds);
    const data =
      action === "activate" ? { status: "ACTIVE" as const } :
      action === "deactivate" ? { status: "DRAFT" as const } :
      action === "delete" ? { deletedAt: new Date(), status: "DRAFT" as const } :
      action === "restore" ? { deletedAt: null } :
      action === "feature" ? { featured: true } : { featured: false };
    const { count } = await db.product.updateMany({ where: { id: { in: list } }, data });
    await logAudit({ actorId: admin.id, action: `product.bulk.${action}`, entityType: "Product", diff: { ids: [null, list.slice(0, 200)], count: [null, count] } });
    revalidateCatalog();
    return ok({ count }, `${count} product${count === 1 ? "" : "s"} updated`);
  });
}

/** Permanently removes soft-deleted products that were never ordered. */
export async function purgeDeleted(productIds: string[]): Promise<ActionResult<{ count: number; kept: number }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const list = ids.parse(productIds);
    const rows = await db.product.findMany({ where: { id: { in: list }, deletedAt: { not: null } }, select: { id: true, _count: { select: { orderItems: true } }, images: { select: { publicId: true } } } });
    const purgeable = rows.filter((r) => r._count.orderItems === 0);
    await db.product.deleteMany({ where: { id: { in: purgeable.map((r) => r.id) } } });
    await Promise.all(purgeable.flatMap((r) => r.images.map((i) => deleteStoredImage(i.publicId))));
    await logAudit({ actorId: admin.id, action: "product.purge", entityType: "Product", diff: { count: [null, purgeable.length] } });
    return ok({ count: purgeable.length, kept: rows.length - purgeable.length }, `${purgeable.length} permanently deleted${rows.length - purgeable.length ? `; ${rows.length - purgeable.length} kept because they have orders` : ""}`);
  });
}

export async function updateStock(productId: string, stock: number): Promise<ActionResult<{ stock: number }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const value = z.number().int().min(0).max(100_000).parse(stock);
    const before = await db.product.findUnique({ where: { id: z.string().cuid().parse(productId) }, select: { stock: true, slug: true } });
    if (!before) throw new UserFacingError("Product not found.");
    await db.product.update({ where: { id: productId }, data: { stock: value } });
    await logAudit({ actorId: admin.id, action: "product.stock", entityType: "Product", entityId: productId, diff: { stock: [before.stock, value] } });
    if (before.stock === 0 && value > 0) void notifyBackInStock([productId]);
    revalidateCatalog([before.slug]);
    return ok({ stock: value }, "Stock updated");
  });
}

"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { ok, runAction, type ActionResult } from "./result";

const id = z.string().cuid();

export async function toggleWishlist(productId: string): Promise<ActionResult<{ wishlisted: boolean }>> {
  return runAction<{ wishlisted: boolean }>(async () => {
    const user = await assertUser();
    const pid = id.parse(productId);
    const existing = await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: pid } } });
    if (existing) {
      await db.wishlistItem.delete({ where: { userId_productId: { userId: user.id, productId: pid } } });
      return ok({ wishlisted: false });
    }
    await db.wishlistItem.create({ data: { userId: user.id, productId: pid } });
    return ok({ wishlisted: true });
  });
}

/** Called once after sign-in with the guest's localStorage wishlist. */
export async function mergeWishlist(productIds: string[]): Promise<ActionResult<{ ids: string[] }>> {
  return runAction<{ ids: string[] }>(async () => {
    const user = await assertUser();
    const ids = z.array(id).max(100).parse(productIds);
    if (ids.length) {
      const live = await db.product.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
      await db.wishlistItem.createMany({ data: live.map((p) => ({ userId: user.id, productId: p.id })), skipDuplicates: true });
    }
    const all = await db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } });
    return ok({ ids: all.map((w) => w.productId) });
  });
}

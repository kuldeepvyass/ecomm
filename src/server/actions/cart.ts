"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { MAX_QTY_PER_ITEM } from "@/server/cart/merge";
import { currentOwner, getOrCreateCartId, loadCartView, type CartView } from "@/server/cart/service";
import { ok, runAction, UserFacingError, type ActionResult } from "./result";

const cuid = z.string().cuid();

async function ownedItem(itemId: string) {
  const owner = await currentOwner(false);
  if (!owner) throw new UserFacingError("Your bag has expired. Please add the item again.");
  const item = await db.cartItem.findFirst({
    where: { id: cuid.parse(itemId), cart: "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken } },
    include: { product: { select: { stock: true } } },
  });
  if (!item) throw new UserFacingError("That item is no longer in your bag.");
  return { owner, item };
}

export async function getCart(): Promise<CartView> {
  return loadCartView(await currentOwner(false));
}

export async function addToBag(productId: string, quantity = 1): Promise<ActionResult<{ count: number }>> {
  return runAction<{ count: number }>(async () => {
    await enforceRateLimit("cart", await clientIp(), 60, 60);
    const pid = cuid.parse(productId);
    const qty = z.number().int().min(1).max(MAX_QTY_PER_ITEM).parse(quantity);
    const product = await db.product.findFirst({ where: { id: pid, status: "ACTIVE", deletedAt: null }, select: { stock: true, modelName: true } });
    if (!product) throw new UserFacingError("This watch is no longer available.");
    if (product.stock <= 0) throw new UserFacingError("Sorry — this watch is sold out.");
    const owner = await currentOwner(true);
    const cartId = await getOrCreateCartId(owner!);
    const existing = await db.cartItem.findUnique({ where: { cartId_productId: { cartId, productId: pid } } });
    const next = Math.min((existing && !existing.savedForLater ? existing.quantity : 0) + qty, MAX_QTY_PER_ITEM);
    if (next > product.stock) throw new UserFacingError(`Only ${product.stock} available — you already have ${existing?.quantity ?? 0} in your bag.`);
    await db.cartItem.upsert({
      where: { cartId_productId: { cartId, productId: pid } },
      create: { cartId, productId: pid, quantity: next },
      update: { quantity: next, savedForLater: false },
    });
    const view = await loadCartView(owner);
    return ok({ count: view.count }, `${product.modelName} added to your bag`);
  });
}

export async function setQuantity(itemId: string, quantity: number): Promise<ActionResult<CartView>> {
  return runAction<CartView>(async () => {
    const { owner, item } = await ownedItem(itemId);
    const qty = z.number().int().min(1).max(MAX_QTY_PER_ITEM).parse(quantity);
    if (qty > item.product.stock) throw new UserFacingError(`Only ${item.product.stock} available.`);
    await db.cartItem.update({ where: { id: item.id }, data: { quantity: qty } });
    return ok(await loadCartView(owner));
  });
}

export async function removeItem(itemId: string): Promise<ActionResult<CartView>> {
  return runAction<CartView>(async () => {
    const { owner, item } = await ownedItem(itemId);
    await db.cartItem.delete({ where: { id: item.id } });
    return ok(await loadCartView(owner));
  });
}

export async function setSavedForLater(itemId: string, saved: boolean): Promise<ActionResult<CartView>> {
  return runAction<CartView>(async () => {
    const { owner, item } = await ownedItem(itemId);
    await db.cartItem.update({ where: { id: item.id }, data: { savedForLater: saved, quantity: saved ? item.quantity : Math.max(1, Math.min(item.quantity, item.product.stock)) } });
    return ok(await loadCartView(owner));
  });
}

export async function applyCoupon(code: string): Promise<ActionResult<CartView>> {
  return runAction<CartView>(async () => {
    await enforceRateLimit("coupon", await clientIp(), 20, 600);
    const clean = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "Invalid code").parse(code).toUpperCase();
    const owner = await currentOwner(false);
    if (!owner) throw new UserFacingError("Add something to your bag first.");
    const cartId = await getOrCreateCartId(owner);
    await db.cart.update({ where: { id: cartId }, data: { couponCode: clean } });
    const view = await loadCartView(owner);
    if (view.couponError || !view.coupon) {
      await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
      throw new UserFacingError(view.couponError ?? "This code isn't valid.");
    }
    return ok(view, `${view.coupon.code} applied`);
  });
}

export async function removeCoupon(): Promise<ActionResult<CartView>> {
  return runAction<CartView>(async () => {
    const owner = await currentOwner(false);
    if (!owner) throw new UserFacingError("Your bag is empty.");
    await db.cart.updateMany({ where: "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken }, data: { couponCode: null } });
    return ok(await loadCartView(owner));
  });
}

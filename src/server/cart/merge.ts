import "server-only";
import { db } from "@/lib/db";
import { reportError } from "@/lib/logger";
import { clearGuestToken, readGuestToken } from "./cookie";

export const MAX_QTY_PER_ITEM = 10;

/** On sign-in, folds the cookie cart into the user's cart (quantities summed, capped). */
export async function mergeGuestStateIntoUser(userId: string) {
  try {
    const token = await readGuestToken();
    if (!token) return;
    const guest = await db.cart.findUnique({ where: { guestToken: token }, include: { items: true } });
    if (guest && guest.items.length > 0) {
      await db.$transaction(async (tx) => {
        const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
        for (const item of guest.items) {
          const existing = await tx.cartItem.findUnique({
            where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
          });
          const quantity = Math.min(MAX_QTY_PER_ITEM, (existing?.quantity ?? 0) + item.quantity);
          await tx.cartItem.upsert({
            where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
            create: { cartId: cart.id, productId: item.productId, quantity, savedForLater: item.savedForLater },
            update: { quantity, savedForLater: existing?.savedForLater && item.savedForLater },
          });
        }
        if (!cart.couponCode && guest.couponCode) {
          await tx.cart.update({ where: { id: cart.id }, data: { couponCode: guest.couponCode } });
        }
        await tx.cart.delete({ where: { id: guest.id } });
      });
    } else if (guest) {
      await db.cart.delete({ where: { id: guest.id } });
    }
    await clearGuestToken();
  } catch (error) {
    reportError(error, { where: "mergeGuestStateIntoUser" });
  }
}

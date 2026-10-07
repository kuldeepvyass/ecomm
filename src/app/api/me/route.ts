import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readGuestToken } from "@/server/cart/cookie";
import { sweepExpiredOrders } from "@/server/orders/service";

export const dynamic = "force-dynamic";

/** Lightweight per-visitor state for the (otherwise static) shell: user, bag count, wishlist. */
export async function GET() {
  sweepExpiredOrders(); // releases stock held by unpaid UPI orders (throttled to once a minute)
  const session = await auth();
  const user = session?.user ?? null;
  let cartCount = 0;
  let wishlistIds: string[] = [];

  if (user) {
    const [cart, wishlist] = await Promise.all([
      db.cart.findUnique({ where: { userId: user.id }, select: { items: { where: { savedForLater: false }, select: { quantity: true } } } }),
      db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } }),
    ]);
    cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
    wishlistIds = wishlist.map((w) => w.productId);
  } else {
    const token = await readGuestToken();
    if (token) {
      const cart = await db.cart.findUnique({ where: { guestToken: token }, select: { items: { where: { savedForLater: false }, select: { quantity: true } } } });
      cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
    }
  }

  return Response.json(
    { user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image } : null, cartCount, wishlistIds },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

import "server-only";
import { db } from "@/lib/db";
import { evaluateCoupon, type CouponRule } from "@/lib/coupons";
import { computeShippingFee } from "@/lib/orders/totals";
import { getSessionUser } from "@/lib/session";
import { readSettings } from "@/server/settings";
import { ensureGuestToken, readGuestToken } from "./cookie";

export type CartLine = {
  itemId: string;
  productId: string;
  href: string;
  brand: string;
  modelName: string;
  reference: string;
  image: { url: string; alt: string; blurDataUrl: string | null } | null;
  mrp: number;
  unitPrice: number;
  quantity: number;
  stock: number;
  available: boolean;
  lineTotal: number;
  isDemo: boolean;
};

export type CartView = {
  id: string | null;
  items: CartLine[];
  saved: CartLine[];
  count: number;
  mrpTotal: number;
  itemsTotal: number;
  productSavings: number;
  coupon: { code: string; discount: number; description: string | null } | null;
  couponError: string | null;
  shippingFee: number;
  freeShippingThreshold: number | null;
  total: number;
  hasUnavailable: boolean;
};

export const EMPTY_CART: CartView = {
  id: null, items: [], saved: [], count: 0, mrpTotal: 0, itemsTotal: 0, productSavings: 0, coupon: null, couponError: null,
  shippingFee: 0, freeShippingThreshold: null, total: 0, hasUnavailable: false,
};

type Owner = { userId: string } | { guestToken: string };

export async function currentOwner(create: boolean): Promise<Owner | null> {
  const user = await getSessionUser();
  if (user) return { userId: user.id };
  const token = create ? await ensureGuestToken() : await readGuestToken();
  return token ? { guestToken: token } : null;
}

export async function getOrCreateCartId(owner: Owner): Promise<string> {
  if ("userId" in owner) {
    return (await db.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId }, update: {}, select: { id: true } })).id;
  }
  return (
    await db.cart.upsert({
      where: { guestToken: owner.guestToken },
      create: { guestToken: owner.guestToken, expiresAt: new Date(Date.now() + 30 * 86_400_000) },
      update: { expiresAt: new Date(Date.now() + 30 * 86_400_000) },
      select: { id: true },
    })
  ).id;
}

export async function couponUsageFor(couponId: string, userId: string | null) {
  if (!userId) return 0;
  return db.couponRedemption.count({ where: { couponId, userId } });
}

export function toCouponRule(c: {
  code: string; type: "PERCENT" | "FLAT"; value: { toString(): string }; maxDiscount: number | null; minOrderValue: number;
  startsAt: Date | null; expiresAt: Date | null; usageLimit: number | null; perUserLimit: number | null; usedCount: number; active: boolean;
}): CouponRule {
  return { ...c, value: Number(c.value) };
}

/** Loads the cart with LIVE server prices — client-sent prices are never used. */
export async function loadCartView(owner: Owner | null): Promise<CartView> {
  if (!owner) return EMPTY_CART;
  const cart = await db.cart.findUnique({
    where: "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            select: {
              id: true, slug: true, modelName: true, referenceNumber: true, mrp: true, sellingPrice: true, stock: true,
              status: true, deletedAt: true, isDemo: true,
              brand: { select: { name: true, slug: true } },
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true, blurDataUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!cart) return EMPTY_CART;
  const settings = await readSettings();

  const toLine = (i: (typeof cart.items)[number]): CartLine => {
    const p = i.product;
    const available = p.status === "ACTIVE" && !p.deletedAt && p.stock >= i.quantity;
    return {
      itemId: i.id, productId: p.id, href: `/watches/${p.brand.slug}/${p.slug}`, brand: p.brand.name, modelName: p.modelName,
      reference: p.referenceNumber, image: p.images[0] ?? null, mrp: p.mrp, unitPrice: p.sellingPrice, quantity: i.quantity,
      stock: p.stock, available, lineTotal: p.sellingPrice * i.quantity, isDemo: p.isDemo,
    };
  };
  const items = cart.items.filter((i) => !i.savedForLater).map(toLine);
  const saved = cart.items.filter((i) => i.savedForLater).map(toLine);
  const billable = items.filter((i) => i.available);
  const mrpTotal = billable.reduce((s, l) => s + l.mrp * l.quantity, 0);
  const itemsTotal = billable.reduce((s, l) => s + l.lineTotal, 0);

  let coupon: CartView["coupon"] = null;
  let couponError: string | null = null;
  if (cart.couponCode) {
    const c = await db.coupon.findUnique({ where: { code: cart.couponCode } });
    const used = c ? await couponUsageFor(c.id, cart.userId) : 0;
    const res = evaluateCoupon(c ? toCouponRule(c) : null, itemsTotal, used);
    if (res.ok) coupon = { code: c!.code, discount: res.discount, description: c!.description };
    else couponError = res.reason;
  }
  const shippingFee = computeShippingFee(itemsTotal, settings.shippingFee, settings.freeShippingThreshold);
  return {
    id: cart.id,
    items,
    saved,
    count: items.reduce((s, l) => s + l.quantity, 0),
    mrpTotal,
    itemsTotal,
    productSavings: mrpTotal - itemsTotal,
    coupon,
    couponError,
    shippingFee,
    freeShippingThreshold: settings.freeShippingThreshold,
    total: itemsTotal - (coupon?.discount ?? 0) + shippingFee,
    hasUnavailable: items.some((i) => !i.available),
  };
}

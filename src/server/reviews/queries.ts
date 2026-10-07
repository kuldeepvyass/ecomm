import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const REVIEW_PAGE_SIZE = 5;
export type ReviewSort = "helpful" | "newest" | "highest" | "lowest";

const ORDER: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  helpful: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
  newest: [{ createdAt: "desc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }],
};

export type ReviewItem = {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  storeReply: string | null;
  images: { url: string; width: number; height: number }[];
  isDemo: boolean;
};

export async function listReviews(productId: string, sort: ReviewSort, page: number, rating?: number) {
  const where: Prisma.ReviewWhereInput = { productId, status: "APPROVED", ...(rating ? { rating } : {}) };
  const [total, rows] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: ORDER[sort],
      skip: (page - 1) * REVIEW_PAGE_SIZE,
      take: REVIEW_PAGE_SIZE,
      select: {
        id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, helpfulCount: true,
        createdAt: true, storeReply: true, isDemo: true,
        images: { orderBy: { position: "asc" }, select: { url: true, width: true, height: true } },
      },
    }),
  ]);
  const items: ReviewItem[] = rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE)) };
}

/** Recomputes the product's aggregate from APPROVED reviews (call inside the same transaction as the change). */
export async function recomputeRating(tx: Prisma.TransactionClient, productId: string) {
  const groups = await tx.review.groupBy({ by: ["rating"], where: { productId, status: "APPROVED" }, _count: true });
  const dist = [0, 0, 0, 0, 0];
  for (const g of groups) dist[g.rating - 1] = g._count;
  const count = dist.reduce((a, b) => a + b, 0);
  const avg = count ? dist.reduce((s, n, i) => s + n * (i + 1), 0) / count : 0;
  await tx.product.update({
    where: { id: productId },
    data: { ratingDist: dist, ratingCount: count, ratingAvg: Math.round(avg * 10) / 10 },
  });
}

/** A customer may review a product once, only after a DELIVERED order containing it. */
export async function findReviewEligibility(userId: string, productId: string) {
  const [existing, item] = await Promise.all([
    db.review.findUnique({ where: { productId_userId: { productId, userId } }, select: { id: true, status: true } }),
    db.orderItem.findFirst({
      where: { productId, order: { userId, status: { in: ["DELIVERED", "RETURN_REQUESTED"] } }, review: null },
      select: { id: true },
      orderBy: { order: { deliveredAt: "desc" } },
    }),
  ]);
  return { alreadyReviewed: Boolean(existing), existingStatus: existing?.status ?? null, orderItemId: item?.id ?? null };
}

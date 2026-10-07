"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";
import { assertUser } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/text";
import { findReviewEligibility } from "@/server/reviews/queries";
import { ok, runAction, UserFacingError, type ActionResult } from "./result";

export async function voteHelpful(reviewId: string): Promise<ActionResult<{ helpfulCount: number; voted: boolean }>> {
  return runAction<{ helpfulCount: number; voted: boolean }>(async () => {
    const user = await assertUser();
    await enforceRateLimit("review-vote", user.id, 60, 3600);
    const id = z.string().cuid().parse(reviewId);
    const review = await db.review.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (!review || review.status !== "APPROVED") throw new UserFacingError("Review not found.");
    if (review.userId === user.id) throw new UserFacingError("You can't vote on your own review.");
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.reviewVote.findUnique({ where: { reviewId_userId: { reviewId: id, userId: user.id } } });
      if (existing) {
        await tx.reviewVote.delete({ where: { reviewId_userId: { reviewId: id, userId: user.id } } });
        const r = await tx.review.update({ where: { id }, data: { helpfulCount: { decrement: 1 } }, select: { helpfulCount: true } });
        return { helpfulCount: r.helpfulCount, voted: false };
      }
      await tx.reviewVote.create({ data: { reviewId: id, userId: user.id } });
      const r = await tx.review.update({ where: { id }, data: { helpfulCount: { increment: 1 } }, select: { helpfulCount: true } });
      return { helpfulCount: r.helpfulCount, voted: true };
    });
    return ok(result);
  });
}

const reviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.coerce.number().int().min(1, "Choose a star rating").max(5),
  title: z.string().trim().min(3, "Add a short title").max(120),
  body: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(4000),
  images: z.array(z.object({ url: z.string().min(1).max(500), width: z.number().int().positive(), height: z.number().int().positive(), publicId: z.string().optional() })).max(4).default([]),
});

export async function submitReview(input: z.input<typeof reviewSchema>): Promise<ActionResult<{ status: string }>> {
  return runAction<{ status: string }>(async () => {
    const user = await assertUser();
    await enforceRateLimit("review", user.id, 5, 3600);
    const data = reviewSchema.parse(input);
    const elig = await findReviewEligibility(user.id, data.productId);
    if (elig.alreadyReviewed) throw new UserFacingError("You've already reviewed this watch.");
    if (!elig.orderItemId) throw new UserFacingError("Only customers who received this watch can review it.");
    for (const img of data.images) {
      const okUrl = img.url.startsWith("/uploads/reviews/") || img.url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`);
      if (!okUrl) throw new UserFacingError("Invalid image.");
    }
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
    const display = dbUser?.name?.trim()
      ? `${dbUser.name.trim().split(/\s+/)[0]} ${(dbUser.name.trim().split(/\s+/)[1]?.[0] ?? "").toUpperCase()}${dbUser.name.trim().split(/\s+/)[1] ? "." : ""}`.trim()
      : "Verified buyer";
    await db.review.create({
      data: {
        productId: data.productId,
        userId: user.id,
        orderItemId: elig.orderItemId,
        authorName: display,
        rating: data.rating,
        title: sanitizeText(data.title, 120),
        body: sanitizeText(data.body, 4000),
        verifiedPurchase: true,
        status: "PENDING",
        images: { create: data.images.map((im, position) => ({ ...im, position })) },
      },
    });
    revalidateTag(TAGS.reviews(data.productId), "max");
    return ok({ status: "PENDING" }, "Thank you! Your review will appear once our team has checked it.");
  });
}

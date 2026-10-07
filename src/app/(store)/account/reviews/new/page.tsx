import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { findReviewEligibility } from "@/server/reviews/queries";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Write a review", robots: { index: false } };

export default async function NewReviewPage({ searchParams }: PageProps<"/account/reviews/new">) {
  const sp = await searchParams;
  const productId = typeof sp.product === "string" ? sp.product : "";
  const user = await requireUser(`/account/reviews/new?product=${productId}`);
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, modelName: true, brand: { select: { name: true } } } });
  if (!product) notFound();
  const elig = await findReviewEligibility(user.id, product.id);
  const name = `${product.brand.name} ${product.modelName}`;
  return (
    <div>
      <h2 className="mb-6 text-3xl">Review the {name}</h2>
      {elig.alreadyReviewed ? (
        <p className="text-fg-muted">You&apos;ve already reviewed this watch. <Link href="/account/reviews" className="text-gold">See your reviews</Link>.</p>
      ) : !elig.orderItemId ? (
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-lg text-fg-muted">Reviews are reserved for clients who have received this watch, so every review is a verified purchase. Once your order is delivered, you can review it here.</p>
          <Button asChild variant="outline"><Link href="/account/orders">View my orders</Link></Button>
        </div>
      ) : (
        <ReviewForm productId={product.id} productName={name} />
      )}
    </div>
  );
}

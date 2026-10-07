import type { Metadata } from "next";
import { MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import { Stars } from "@/components/product/rating";
import { Badge, EmptyState } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My reviews", robots: { index: false } };

export default async function MyReviewsPage() {
  const user = await requireUser("/account/reviews");
  const [reviews, pending] = await Promise.all([
    db.review.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { product: { select: { modelName: true, slug: true, brand: { select: { name: true, slug: true } } } } } }),
    db.orderItem.findMany({
      where: { order: { userId: user.id, status: "DELIVERED" }, review: null },
      distinct: ["productId"],
      select: { productId: true, brandName: true, modelName: true },
    }),
  ]);
  const reviewedIds = new Set(reviews.map((r) => r.productId));
  const toReview = pending.filter((p) => !reviewedIds.has(p.productId));
  return (
    <div className="flex flex-col gap-10">
      {toReview.length > 0 && (
        <section>
          <h2 className="mb-4 text-3xl">Awaiting your review</h2>
          <ul className="flex flex-col gap-2">
            {toReview.map((p) => (
              <li key={p.productId} className="flex items-center justify-between border border-border p-4">
                <span>{p.brandName} {p.modelName}</span>
                <Link href={`/account/reviews/new?product=${p.productId}`} className="text-sm text-gold underline underline-offset-4 hover:decoration-2">Write a review</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-4 text-3xl">My reviews</h2>
        {reviews.length === 0 ? (
          <EmptyState icon={<MessageSquareQuote />} title="No reviews yet" description="Once your watch is delivered, you can share your experience." />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {reviews.map((r) => (
              <li key={r.id} className="py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/watches/${r.product.brand.slug}/${r.product.slug}`} className="font-display text-xl hover:text-gold">{r.product.brand.name} {r.product.modelName}</Link>
                  <Badge tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "outline"}>{r.status === "PENDING" ? "In moderation" : r.status.toLowerCase()}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2"><Stars value={r.rating} /> <span className="font-medium">{r.title}</span></div>
                <p className="mt-2 text-sm text-fg-muted">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { Stars } from "@/components/product/rating";
import { Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ReviewModeration } from "./review-moderation";

export const metadata: Metadata = { title: "Reviews" };

export default async function Reviews({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status === "APPROVED" || sp.status === "REJECTED" ? sp.status : "PENDING";
  const showDemo = sp.demo === "1";
  const [reviews, counts] = await Promise.all([
    db.review.findMany({
      where: { status, ...(showDemo ? {} : { isDemo: false }) }, orderBy: { createdAt: "desc" }, take: 50,
      include: { product: { select: { id: true, modelName: true, brand: { select: { name: true } } } }, images: true, user: { select: { email: true } } },
    }),
    db.review.groupBy({ by: ["status"], where: showDemo ? {} : { isDemo: false }, _count: true }),
  ]);
  return (
    <div>
      <PageHeader title="Reviews" description="Only customers with a delivered order can review. Nothing is published until approved." />
      <div className="mb-6 flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}${showDemo ? "&demo=1" : ""}`} className={cn("min-h-10 rounded-full border px-4 text-xs uppercase leading-10 tracking-[0.12em]", status === s ? "border-gold text-gold" : "border-border text-fg-muted")}>
            {s.toLowerCase()} ({counts.find((c) => c.status === s)?._count ?? 0})
          </Link>
        ))}
        <Link href={`/admin/reviews?status=${status}${showDemo ? "" : "&demo=1"}`} className="min-h-10 px-3 text-xs leading-10 text-fg-muted underline">{showDemo ? "Hide" : "Show"} sample reviews</Link>
      </div>
      <ul className="flex flex-col gap-4" data-testid="admin-reviews">
        {reviews.map((r) => (
          <li key={r.id} className="border border-border p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Stars value={r.rating} /> <strong className="font-medium">{r.title}</strong>
              {r.verifiedPurchase && <Badge tone="success">Verified</Badge>}{r.isDemo && <Badge tone="outline">Sample</Badge>}
            </div>
            <p className="mt-1 text-xs text-fg-muted">{r.authorName}{r.user ? ` (${r.user.email})` : ""} · <Link className="hover:text-gold" href={`/admin/products/${r.product.id}`}>{r.product.brand.name} {r.product.modelName}</Link> · {r.createdAt.toLocaleDateString("en-IN")}</p>
            <p className="mt-2 text-sm">{r.body}</p>
            {r.images.length > 0 && <p className="mt-2 text-xs text-fg-muted">{r.images.length} photo(s): {r.images.map((i) => <a key={i.id} href={i.url} target="_blank" rel="noopener" className="mr-2 text-gold underline">view</a>)}</p>}
            <ReviewModeration id={r.id} status={r.status} reply={r.storeReply ?? ""} />
          </li>
        ))}
        {reviews.length === 0 && <li className="border border-border p-10 text-center text-fg-muted">Nothing here.</li>}
      </ul>
    </div>
  );
}

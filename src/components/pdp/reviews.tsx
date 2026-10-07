"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, MessageSquareQuote, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useStore } from "@/components/providers";
import { Stars } from "@/components/product/rating";
import { WatchImage } from "@/components/product/watch-image";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { voteHelpful } from "@/server/actions/reviews";
import type { ReviewItem } from "@/server/reviews/queries";

type Page = { items: ReviewItem[]; total: number; page: number; pages: number };

export function ReviewsSection({ productId, avg, count, dist, initial, writeHref }: {
  productId: string;
  avg: number;
  count: number;
  dist: number[];
  initial: Page;
  writeHref: string;
}) {
  const [sort, setSort] = useState<"helpful" | "newest" | "highest" | "lowest">("helpful");
  const [rating, setRating] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page>(initial);
  const [loading, start] = useTransition();
  const [first, setFirst] = useState(true);

  const load = useCallback(() => {
    start(async () => {
      const qs = new URLSearchParams({ sort, page: String(page) });
      if (rating) qs.set("rating", String(rating));
      const res = await fetch(`/api/products/${productId}/reviews?${qs}`);
      if (res.ok) setData(await res.json());
    });
  }, [productId, sort, page, rating]);

  useEffect(() => {
    if (first) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- skip refetch of SSR page
      setFirst(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, page, rating]);

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-24">
      <h2 id="reviews-heading" className="mb-8 text-3xl md:text-4xl">Client reviews</h2>
      {count === 0 ? (
        <div className="flex flex-col items-start gap-4 border border-border p-6 md:p-10">
          <MessageSquareQuote className="size-8 text-gold" aria-hidden />
          <p className="font-display text-2xl">Be the first to review</p>
          <p className="max-w-md text-fg-muted">Reviews come only from clients who have received this watch, so every one is a verified purchase.</p>
          <Link href={writeHref} className="text-sm text-gold underline underline-offset-4 hover:decoration-2">Purchased this watch? Write a review</Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-16">
          <div>
            <p className="font-display text-6xl">{avg.toFixed(1)}</p>
            <Stars value={avg} size={18} className="mt-2" />
            <p className="mt-2 text-sm text-fg-muted">Based on {count} {count === 1 ? "review" : "reviews"}</p>
            <ul className="mt-6 flex flex-col gap-1" aria-label="Rating breakdown">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = dist[star - 1] ?? 0;
                const pct = count ? Math.round((n / count) * 100) : 0;
                const active = rating === star;
                return (
                  <li key={star}>
                    <button type="button" onClick={() => { setRating(active ? null : star); setPage(1); }} aria-pressed={active}
                      className={cn("flex min-h-9 w-full items-center gap-3 text-sm transition-opacity", rating && !active && "opacity-50")}
                      aria-label={`${star} star: ${pct}% (${n} reviews). ${active ? "Clear filter" : "Filter"}`}>
                      <span className="w-6 shrink-0 text-left">{star}★</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-fg-muted">{pct}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link href={writeHref} className="mt-6 inline-flex min-h-11 items-center text-sm text-gold underline underline-offset-4 hover:decoration-2">Write a review</Link>
          </div>

          <div aria-busy={loading}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-fg-muted">{rating ? `${data.total} ${rating}★ reviews` : `${data.total} reviews`}</p>
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">Sort reviews</span>
                <select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
                  className="h-10 rounded-[2px] border border-border bg-surface px-3 text-xs uppercase tracking-[0.12em] focus:border-gold focus:outline-none">
                  <option value="helpful">Most helpful</option>
                  <option value="newest">Newest</option>
                  <option value="highest">Highest rated</option>
                  <option value="lowest">Lowest rated</option>
                </select>
              </label>
            </div>
            <ul className={cn("divide-y divide-border border-y border-border transition-opacity", loading && "opacity-50")}>
              {data.items.map((r) => <ReviewRow key={r.id} review={r} />)}
            </ul>
            {data.pages > 1 && (
              <nav aria-label="Review pages" className="mt-6 flex items-center justify-between">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="inline-flex min-h-11 items-center gap-1 text-sm disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden /> Previous</button>
                <span className="text-sm text-fg-muted">Page {data.page} of {data.pages}</span>
                <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                  className="inline-flex min-h-11 items-center gap-1 text-sm disabled:opacity-40">Next <ChevronRight className="size-4" aria-hidden /></button>
              </nav>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewRow({ review: r }: { review: ReviewItem }) {
  const { user } = useStore();
  const [helpful, setHelpful] = useState(r.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [pending, start] = useTransition();
  const date = new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  function vote() {
    if (!user) {
      toast.message("Sign in to vote", { action: { label: "Sign in", onClick: () => (window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(location.pathname)}`) } });
      return;
    }
    if (r.isDemo) {
      setVoted((v) => !v);
      setHelpful((h) => h + (voted ? -1 : 1));
      return;
    }
    start(async () => {
      const res = await voteHelpful(r.id);
      if (res.ok) { setHelpful(res.data.helpfulCount); setVoted(res.data.voted); } else toast.error(res.error);
    });
  }

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.rating} />
        <p className="font-medium">{r.title}</p>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span>{r.authorName}</span>
        <span aria-hidden>·</span>
        <time dateTime={r.createdAt}>{date}</time>
        {r.verifiedPurchase && <span className="inline-flex items-center gap-1 text-success"><BadgeCheck className="size-3.5" aria-hidden /> Verified Purchase</span>}
        {r.isDemo && <Badge tone="outline" className="h-5">Sample</Badge>}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{r.body}</p>
      {r.images.length > 0 && (
        <ul className="mt-4 flex gap-2">
          {r.images.map((img) => (
            <li key={img.url} className="relative size-20 overflow-hidden bg-surface-2">
              <WatchImage src={img.url} alt={`Photo from ${r.authorName}`} fill sizes="80px" className="object-cover" />
            </li>
          ))}
        </ul>
      )}
      {r.storeReply && (
        <div className="mt-4 border-l-2 border-gold pl-4 text-sm">
          <p className="eyebrow mb-1 text-gold">Response from Maison Horlogère</p>
          <p className="text-fg-muted">{r.storeReply}</p>
        </div>
      )}
      <button type="button" onClick={vote} disabled={pending} aria-pressed={voted}
        className={cn("mt-4 inline-flex min-h-11 items-center gap-2 text-xs transition-colors hover:text-gold", voted ? "text-gold" : "text-fg-muted")}>
        <ThumbsUp className="size-4" aria-hidden /> Helpful ({helpful})
      </button>
    </li>
  );
}

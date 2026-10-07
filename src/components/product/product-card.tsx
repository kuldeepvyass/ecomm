import Link from "next/link";
import type { ProductCardData } from "@/server/catalog/types";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { PriceTag } from "./price-tag";
import { ExternalRating, Stars } from "./rating";
import { WatchImage } from "./watch-image";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({ product: p, priority = false, sizes, className }: {
  product: ProductCardData;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const href = `/watches/${p.brand.slug}/${p.slug}`;
  const label = `${p.brand.name} ${p.modelName}`;
  const [primary, secondary] = p.images;
  const lowStock = p.stock > 0 && p.stock <= 2;

  return (
    <article className={cn("group relative flex flex-col", className)} data-testid="product-card">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-surface-2" aria-label={label}>
        {primary && (
          <WatchImage
            src={primary.url}
            alt={primary.alt}
            fill
            sizes={sizes ?? "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"}
            priority={priority}
            blurDataUrl={primary.blurDataUrl}
            className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.04]"
          />
        )}
        {secondary && (
          <WatchImage
            src={secondary.url}
            alt=""
            fill
            sizes={sizes ?? "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"}
            className="hidden object-cover opacity-0 transition-opacity duration-500 [@media(hover:hover)]:block group-hover:opacity-100"
          />
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          {p.isDemo && <Badge tone="outline" className="border-transparent bg-bg text-fg">Sample</Badge>}
          {p.stock === 0 ? (
            <Badge tone="neutral">Sold out</Badge>
          ) : lowStock ? (
            <Badge tone="gold">Only {p.stock} left</Badge>
          ) : null}
        </div>
      </Link>
      <WishlistButton productId={p.id} label={label} className="absolute right-2 top-2" />
      <div className="flex flex-1 flex-col gap-1 pt-3 md:pt-4">
        <p className="small-caps text-xs text-fg-muted">{p.brand.name}</p>
        <h3 className="font-display text-lg leading-tight md:text-xl">
          <Link href={href} className="hover:text-gold">{p.modelName}</Link>
        </h3>
        <PriceTag mrp={p.mrp} price={p.sellingPrice} size="sm" className="mt-1" />
        {p.externalRating !== null ? (
          <ExternalRating rating={p.externalRating} count={p.externalRatingCount} source={p.externalRatingSource} className="mt-1" />
        ) : p.ratingCount > 0 ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
            <Stars value={p.ratingAvg} size={12} /> <span>({p.ratingCount})</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="skeleton aspect-[4/5]" />
      <div className="skeleton mt-4 h-3 w-1/3" />
      <div className="skeleton mt-2 h-5 w-3/4" />
      <div className="skeleton mt-2 h-4 w-1/2" />
    </div>
  );
}

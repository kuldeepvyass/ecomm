import { Star } from "lucide-react";
import { formatCount } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star className="absolute inset-0 text-border-strong" style={{ width: size, height: size }} strokeWidth={1.5} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-gold text-gold" style={{ width: size, height: size }} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Only rendered when real values were supplied (admin form or imported dataset) — never generated. */
export function ExternalRating({ rating, count, source, className }: {
  rating: number | null;
  count: number | null;
  source: string | null;
  className?: string;
}) {
  if (rating === null) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-fg-muted", className)}>
      <Star className="size-3.5 fill-gold text-gold" aria-hidden />
      <span className="font-medium text-fg">{rating.toFixed(1)}</span>
      {count !== null && <span>· {formatCount(count)} ratings</span>}
      {source && <span>on {source}</span>}
    </p>
  );
}

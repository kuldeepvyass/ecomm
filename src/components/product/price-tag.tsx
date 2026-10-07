import { discountBadgePct } from "@/lib/pricing";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PriceTag({ mrp, price, size = "md", className }: {
  mrp: number;
  price: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = discountBadgePct(mrp, price);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-medium text-fg", size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm")}>
        <span className="sr-only">Price </span>
        {formatINR(price)}
      </span>
      {pct > 0 && (
        <>
          <s className={cn("text-fg-subtle", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">MRP </span>
            {formatINR(mrp)}
          </s>
          <span className={cn("font-medium text-gold", size === "lg" ? "text-sm" : "text-xs")}>{pct}% off</span>
        </>
      )}
    </div>
  );
}

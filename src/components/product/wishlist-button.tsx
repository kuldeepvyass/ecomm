"use client";

import { Heart } from "lucide-react";
import { m } from "framer-motion";
import { useStore } from "@/components/providers";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, label, className, variant = "overlay", testId = "wishlist-toggle" }: {
  productId: string;
  label: string;
  className?: string;
  variant?: "overlay" | "outline";
  testId?: string;
}) {
  const { wishlist, toggleWishlist } = useStore();
  const active = wishlist.has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleWishlist(productId, label);
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${label} from wishlist` : `Save ${label} to wishlist`}
      data-testid={testId}
      className={cn(
        "grid size-11 place-items-center rounded-full transition-colors",
        variant === "overlay" ? "bg-bg/60 text-fg backdrop-blur-sm hover:text-gold" : "border border-border-strong hover:border-gold hover:text-gold",
        active && "text-gold",
        className,
      )}
    >
      <m.span key={String(active)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
        <Heart className={cn("size-5", active && "fill-gold")} strokeWidth={1.5} aria-hidden />
      </m.span>
    </button>
  );
}

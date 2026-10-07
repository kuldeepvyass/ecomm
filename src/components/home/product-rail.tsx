import { ProductCard } from "@/components/product/product-card";
import type { ProductCardData } from "@/server/catalog/types";

/** Swipeable rail on mobile (scroll-snap, no JS), 4-up grid on desktop. */
export function ProductRail({ products }: { products: ProductCardData[] }) {
  return (
    <div tabIndex={0} role="region" aria-label="Watches — scroll horizontally" className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-4 lg:gap-8">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} className="w-[68vw] shrink-0 snap-start sm:w-[42vw] md:w-auto" sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 68vw" />
      ))}
    </div>
  );
}

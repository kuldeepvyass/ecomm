import { hasDemoData } from "@/server/catalog/queries";

/** Site-wide notice while any isDemo data exists; disappears once sample data is deleted. */
export async function PreviewBanner() {
  if (!(await hasDemoData())) return null;
  return (
    <div role="note" className="border-b border-gold/30 bg-gold-soft text-center text-[0.6875rem] uppercase tracking-[0.18em] text-gold">
      <p className="container-luxe py-2">Preview mode — sample data<span className="hidden md:inline">. Brands, products and reviews shown are illustrative.</span></p>
    </div>
  );
}

import { Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { countProducts, getFacets, listProducts } from "@/server/catalog/queries";
import { parseListingParams } from "@/server/catalog/params";
import { DesktopFilters, ListingToolbar } from "./filters";
import { InfiniteGrid } from "./infinite-grid";

/** Shared listing used by /watches, brand, collection and search pages. */
export async function Listing({ searchParams, fixed = {}, lock = {}, showRelevance = false }: {
  searchParams: Record<string, string | string[] | undefined>;
  fixed?: Record<string, string>;
  lock?: { brand?: boolean; gender?: boolean };
  showRelevance?: boolean;
}) {
  const { filters, sort } = parseListingParams({ ...searchParams, ...fixed });
  const [page, total, facets] = await Promise.all([listProducts({ filters, sort }), countProducts(filters), getFacets()]);

  return (
    <div className="grid gap-10 lg:grid-cols-[15rem_1fr] xl:grid-cols-[16rem_1fr]">
      <Suspense>
        <DesktopFilters facets={facets} lock={lock} />
      </Suspense>
      <div>
        <Suspense>
          <ListingToolbar facets={facets} total={total} lock={lock} showRelevance={showRelevance} />
        </Suspense>
        {page.items.length === 0 ? (
          <EmptyState icon={<Search />} title="No watches match" description="Try removing a filter or two — or browse the full collection."
            action={<Button asChild variant="outline"><Link href="/watches">View all watches</Link></Button>} />
        ) : (
          <Suspense>
            <InfiniteGrid initial={page.items} initialCursor={page.nextCursor} fixed={fixed} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

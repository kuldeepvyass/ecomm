import { z } from "zod";
import type { ListingFilters, SortKey } from "./types";

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined ? undefined : (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean).slice(0, 20)));
const int = z.coerce.number().int().min(0).max(100_000_000).optional().catch(undefined);

const schema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  brand: list,
  collection: z.string().max(80).optional().catch(undefined),
  min: int,
  max: int,
  size: list,
  movement: list.transform((v) => v?.filter((m) => ["AUTOMATIC", "QUARTZ", "MANUAL", "SOLAR", "KINETIC", "SMART"].includes(m)) as ListingFilters["movements"]),
  type: list,
  shape: list,
  strap: list,
  dial: list,
  gender: z.enum(["MEN", "WOMEN"]).optional().catch(undefined),
  instock: z.string().optional().transform((v) => v === "1" || v === "true"),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc", "rating", "popular"]).optional().catch(undefined),
});

/** Parses (untrusted) URL params into typed listing filters. Never throws. */
export function parseListingParams(raw: Record<string, string | string[] | undefined>): { filters: ListingFilters; sort: SortKey } {
  const p = schema.parse(raw);
  return {
    filters: {
      q: p.q || undefined,
      brands: p.brand,
      collection: p.collection,
      minPrice: p.min,
      maxPrice: p.max,
      sizes: p.size,
      movements: p.movement,
      straps: p.strap,
      types: p.type,
      shapes: p.shape,
      dials: p.dial,
      gender: p.gender,
      inStock: p.instock || undefined,
    },
    sort: p.sort === "relevance" && !p.q ? "newest" : (p.sort ?? (p.q ? "relevance" : "newest")),
  };
}

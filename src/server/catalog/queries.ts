import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";
import { normalizeSearch } from "@/lib/text";
import type { ListingFilters, ProductCardData, SortKey } from "./types";

export const PAGE_SIZE = 12;

/** Storefront-safe product predicate: never cost price, never drafts/deleted. */
export const LIVE: Prisma.ProductWhereInput = { status: "ACTIVE", deletedAt: null };

export const cardSelect = {
  id: true,
  slug: true,
  modelName: true,
  referenceNumber: true,
  mrp: true,
  sellingPrice: true,
  stock: true,
  ratingAvg: true,
  ratingCount: true,
  externalRating: true,
  externalRatingCount: true,
  externalRatingSource: true,
  gender: true,
  movement: true,
  caseDiameterMm: true,
  isDemo: true,
  featured: true,
  brand: { select: { name: true, slug: true } },
  images: {
    orderBy: { position: "asc" },
    take: 2,
    select: { url: true, alt: true, width: true, height: true, blurDataUrl: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export function toCard(p: CardRow): ProductCardData {
  return {
    ...p,
    ratingAvg: Number(p.ratingAvg),
    externalRating: p.externalRating === null ? null : Number(p.externalRating),
    caseDiameterMm: Number(p.caseDiameterMm),
  };
}

const SIZE_RANGES: Record<string, [number, number]> = {
  lt36: [0, 35.99],
  "36-39": [36, 39.99],
  "40-42": [40, 42.99],
  gt42: [43, 99],
};

export function buildWhere(f: ListingFilters, ids?: string[]): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [LIVE];
  if (ids) and.push({ id: { in: ids } });
  if (f.brands?.length) and.push({ brand: { slug: { in: f.brands } } });
  if (f.collection) and.push({ collections: { some: { collection: { slug: f.collection } } } });
  if (f.minPrice !== undefined) and.push({ sellingPrice: { gte: f.minPrice } });
  if (f.maxPrice !== undefined) and.push({ sellingPrice: { lte: f.maxPrice } });
  if (f.sizes?.length) {
    and.push({
      OR: f.sizes
        .filter((s) => SIZE_RANGES[s])
        .map((s) => ({ caseDiameterMm: { gte: SIZE_RANGES[s][0], lte: SIZE_RANGES[s][1] } })),
    });
  }
  if (f.movements?.length) and.push({ movement: { in: f.movements } });
  // Strap filter uses the normalised strap type ("Leather", "Metal bracelet"…); raw material still matches old links.
  if (f.straps?.length) and.push({ OR: [{ strapType: { in: f.straps, mode: "insensitive" } }, { strapMaterial: { in: f.straps, mode: "insensitive" } }] });
  if (f.types?.length) and.push({ watchType: { in: f.types, mode: "insensitive" } });
  if (f.shapes?.length) and.push({ caseShape: { in: f.shapes, mode: "insensitive" } });
  if (f.dials?.length) and.push({ dialColour: { in: f.dials, mode: "insensitive" } });
  if (f.gender) and.push({ gender: { in: [f.gender, "UNISEX"] } });
  if (f.inStock) and.push({ stock: { gt: 0 } });
  return { AND: and };
}

export function orderFor(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ sellingPrice: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ sellingPrice: "desc" }, { id: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "desc" }];
    case "popular":
      return [{ soldCount: "desc" }, { viewCount: "desc" }, { id: "desc" }];
    case "recommended":
      return [{ rankScore: "desc" }, { sellingPrice: "desc" }, { id: "desc" }];
    case "newest":
    case "relevance":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/** Typo-tolerant id search via pg_trgm; exact reference / prefix hits rank first. */
export async function searchProductIds(q: string, limit = 200): Promise<string[]> {
  const term = normalizeSearch(q);
  if (!term) return [];
  const compact = term.replace(/[^a-z0-9]/g, "");
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Product"
    WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL AND (
      "searchText" ILIKE ${"%" + term + "%"}
      OR (${compact.length >= 3} AND "searchText" ILIKE ${"%" + compact + "%"})
      OR word_similarity(${term}, "searchText") > 0.35
    )
    ORDER BY
      ("searchText" ILIKE ${"%" + term + "%"}) DESC,
      word_similarity(${term}, "searchText") DESC,
      "soldCount" DESC
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

export async function listProducts(opts: {
  filters: ListingFilters;
  sort: SortKey;
  cursor?: string | null;
  take?: number;
}): Promise<{ items: ProductCardData[]; nextCursor: string | null }> {
  const take = opts.take ?? PAGE_SIZE;
  let ids: string[] | undefined;
  if (opts.filters.q) {
    ids = await searchProductIds(opts.filters.q);
    if (ids.length === 0) return { items: [], nextCursor: null };
  }
  if (ids && opts.sort === "relevance") {
    // Keep pg_trgm ranking: filter the ranked ids, then paginate by position.
    const allowed = await db.product.findMany({ where: buildWhere(opts.filters, ids), select: { id: true } });
    const allowedSet = new Set(allowed.map((r) => r.id));
    const ranked = ids.filter((id) => allowedSet.has(id));
    const start = opts.cursor ? ranked.indexOf(opts.cursor) + 1 : 0;
    const pageIds = ranked.slice(start, start + take);
    const items = await getCardsByIds(pageIds);
    return { items, nextCursor: start + take < ranked.length ? pageIds[pageIds.length - 1] : null };
  }
  const rows = await db.product.findMany({
    where: buildWhere(opts.filters, ids),
    orderBy: orderFor(opts.sort),
    select: cardSelect,
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = rows.slice(0, take).map(toCard);
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function countProducts(filters: ListingFilters): Promise<number> {
  let ids: string[] | undefined;
  if (filters.q) {
    ids = await searchProductIds(filters.q);
    if (ids.length === 0) return 0;
  }
  return db.product.count({ where: buildWhere(filters, ids) });
}

export const getFacets = unstable_cache(
  async () => {
    const [brands, straps, dials, price, types, shapes, movements] = await Promise.all([
      db.brand.findMany({
        where: { products: { some: LIVE } },
        orderBy: { name: "asc" },
        select: { name: true, slug: true, _count: { select: { products: { where: LIVE } } } },
      }),
      db.product.groupBy({ by: ["strapType"], where: { ...LIVE, strapType: { not: null } }, _count: true, orderBy: { strapType: "asc" } }),
      db.product.groupBy({ by: ["dialColour"], where: LIVE, _count: true, orderBy: { dialColour: "asc" } }),
      db.product.aggregate({ where: LIVE, _min: { sellingPrice: true }, _max: { sellingPrice: true } }),
      db.product.groupBy({ by: ["watchType"], where: { ...LIVE, watchType: { not: null } }, _count: true, orderBy: { watchType: "asc" } }),
      db.product.groupBy({ by: ["caseShape"], where: { ...LIVE, caseShape: { not: null } }, _count: true, orderBy: { caseShape: "asc" } }),
      db.product.groupBy({ by: ["movement"], where: LIVE, _count: true }),
    ]);
    return {
      brands: brands.map((b) => ({ name: b.name, slug: b.slug, count: b._count.products })),
      straps: straps.filter((s) => s.strapType).map((s) => ({ value: s.strapType!, count: s._count })),
      types: types.filter((t) => t.watchType).map((t) => ({ value: t.watchType!, count: t._count })),
      shapes: shapes.filter((t) => t.caseShape).map((t) => ({ value: t.caseShape!, count: t._count })),
      movements: Object.fromEntries(movements.map((m) => [m.movement, m._count])) as Record<string, number>,
      dials: dials.map((d) => ({ value: d.dialColour, count: d._count })),
      priceMin: price._min.sellingPrice ?? 0,
      priceMax: price._max.sellingPrice ?? 0,
    };
  },
  ["facets"],
  { tags: [TAGS.products, TAGS.brands] },
);

export const getFeaturedProducts = unstable_cache(
  async (take = 8) => {
    const rows = await db.product.findMany({
      where: { ...LIVE, featured: true },
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
      select: cardSelect,
      take,
    });
    return rows.map(toCard);
  },
  ["featured"],
  { tags: [TAGS.products] },
);

export const getNewArrivals = unstable_cache(
  async (take = 8) => (await db.product.findMany({ where: LIVE, orderBy: { createdAt: "desc" }, select: cardSelect, take })).map(toCard),
  ["new-arrivals"],
  { tags: [TAGS.products] },
);

export const getCollections = unstable_cache(
  async () =>
    db.collection.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, name: true, slug: true, description: true, heroImage: true, showOnHome: true,
        _count: { select: { products: { where: { product: LIVE } } } },
      },
    }),
  ["collections"],
  { tags: [TAGS.collections, TAGS.products] },
);

export const getBrands = unstable_cache(
  async () =>
    db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, tagline: true, story: true, heroImage: true, logoUrl: true, isDemo: true,
        _count: { select: { products: { where: LIVE } } } },
    }),
  ["brands"],
  { tags: [TAGS.brands, TAGS.products] },
);

export const productDetailSelect = {
  ...cardSelect,
  series: true,
  watchType: true,
  caseShape: true,
  functions: true,
  specialFeatures: true,
  description: true,
  sku: true,
  status: true,
  hsnCode: true,
  caseMaterial: true,
  caseThicknessMm: true,
  lugWidthMm: true,
  dialColour: true,
  strapMaterial: true,
  strapColour: true,
  calibre: true,
  powerReserveHours: true,
  waterResistanceM: true,
  crystal: true,
  weightGrams: true,
  warrantyMonths: true,
  boxAndPapers: true,
  seoTitle: true,
  seoDescription: true,
  ratingDist: true,
  lowStockAt: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, slug: true, story: true, tagline: true, origin: true } },
  images: {
    orderBy: { position: "asc" },
    select: { id: true, url: true, alt: true, width: true, height: true, blurDataUrl: true },
  },
  collections: { select: { collection: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ProductSelect;

export type ProductDetail = ReturnType<typeof toDetail>;

function toDetail(p: Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>) {
  return {
    ...p,
    ratingAvg: Number(p.ratingAvg),
    externalRating: p.externalRating === null ? null : Number(p.externalRating),
    caseDiameterMm: Number(p.caseDiameterMm),
    caseThicknessMm: p.caseThicknessMm === null ? null : Number(p.caseThicknessMm),
    collections: p.collections.map((c) => c.collection),
  };
}

export const getProductBySlug = (slug: string) =>
  unstable_cache(
    async () => {
      const p = await db.product.findFirst({ where: { ...LIVE, slug }, select: productDetailSelect });
      return p ? toDetail(p) : null;
    },
    ["product", slug],
    { tags: [TAGS.products, TAGS.product(slug)] },
  )();

export const getRelatedProducts = unstable_cache(
  async (productId: string, brandId: string, collectionIds: string[], take = 8) => {
    const rows = await db.product.findMany({
      where: {
        ...LIVE,
        id: { not: productId },
        OR: [{ brandId }, { collections: { some: { collectionId: { in: collectionIds } } } }],
      },
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
      select: cardSelect,
      take,
    });
    return rows.map(toCard);
  },
  ["related"],
  { tags: [TAGS.products] },
);

export async function getCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({ where: { ...LIVE, id: { in: ids } }, select: cardSelect });
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is ProductCardData => Boolean(x));
}

export const hasDemoData = unstable_cache(
  async () => (await db.product.count({ where: { isDemo: true, deletedAt: null } })) > 0,
  ["has-demo"],
  { tags: [TAGS.demo, TAGS.products] },
);

export function productUrl(p: { slug: string; brand: { slug: string } }) {
  return `/watches/${p.brand.slug}/${p.slug}`;
}

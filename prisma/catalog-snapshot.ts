/**
 * The store's real catalogue, versioned in git (prisma/data/catalog.json): brands, collections, products,
 * product images, collection membership and homepage banners. No users, orders or settings — nothing private.
 *
 *   npm run catalog:export   write the current local catalogue to the snapshot (commit it afterwards)
 *   seed with SEED_DEMO=0    loads the snapshot into an EMPTY database (fresh laptop, first production deploy)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";

export const SNAPSHOT_FILE = path.join(__dirname, "data", "catalog.json");

type Snapshot = {
  exportedAt: string;
  brands: Record<string, unknown>[];
  collections: Record<string, unknown>[];
  products: Record<string, unknown>[];
  productImages: Record<string, unknown>[];
  productCollections: Record<string, unknown>[];
  homeBanners: Record<string, unknown>[];
};

export async function exportCatalog(db: PrismaClient) {
  const live = { deletedAt: null };
  const products = await db.product.findMany({ where: live, orderBy: { createdAt: "asc" } });
  const ids = new Set(products.map((p) => p.id));
  const snap: Snapshot = {
    exportedAt: new Date().toISOString(),
    brands: await db.brand.findMany({ where: { products: { some: live } }, orderBy: { name: "asc" } }),
    collections: await db.collection.findMany({ orderBy: { sortOrder: "asc" } }),
    // rankScore is computed by Postgres; costPrice is private (the repo is public) — neither is exported.
    products: products.map(({ rankScore: _r, costPrice: _c, ...p }) => p),
    productImages: (await db.productImage.findMany({ orderBy: [{ productId: "asc" }, { position: "asc" }] })).filter((i) => ids.has(i.productId)),
    productCollections: (await db.productCollection.findMany()).filter((pc) => ids.has(pc.productId)),
    homeBanners: await db.homeBanner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] }),
  };
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap, null, 1) + "\n");
  return { products: snap.products.length, brands: snap.brands.length, collections: snap.collections.length, banners: snap.homeBanners.length };
}

/** Loads the snapshot only into a store with no products; returns null when skipped. */
export async function loadCatalog(db: PrismaClient) {
  if (!existsSync(SNAPSHOT_FILE)) return null;
  if ((await db.product.count()) > 0) return null;
  const s = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as Snapshot;
  /* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from a previous findMany */
  await db.$transaction(async (tx) => {
    await tx.homeBanner.deleteMany(); // replace the default banners with the store's own
    await tx.brand.createMany({ data: s.brands as any, skipDuplicates: true });
    for (const c of s.collections as any[]) await tx.collection.upsert({ where: { slug: c.slug }, create: c, update: c });
    await tx.product.createMany({ data: s.products as any });
    await tx.productImage.createMany({ data: s.productImages as any });
    const cols = new Map((await tx.collection.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
    const slugById = new Map((s.collections as any[]).map((c) => [c.id, c.slug]));
    await tx.productCollection.createMany({
      data: (s.productCollections as any[]).map((pc) => ({ ...pc, collectionId: cols.get(slugById.get(pc.collectionId)) ?? pc.collectionId })),
      skipDuplicates: true,
    });
    await tx.homeBanner.createMany({ data: s.homeBanners as any });
  }, { timeout: 120_000 });
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { products: s.products.length, exportedAt: s.exportedAt };
}

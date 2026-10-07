import "server-only";
import { db } from "@/lib/db";
import { currentGlobalPct } from "@/server/catalog/admin";

export async function productFormContext() {
  const [brands, collections, globalPct] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    currentGlobalPct(),
  ]);
  return { brands: brands.map((b) => b.name), collections: collections.map((c) => c.name), globalPct };
}

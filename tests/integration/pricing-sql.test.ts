import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sellingPrice, effectiveDiscountPct } from "@/lib/pricing";
import { resetCatalog, testDb } from "./helpers";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
const db = testDb();
vi.mock("@/lib/db", () => ({ db }));

const { repriceAll } = await import("@/server/catalog/admin");

beforeAll(async () => {
  await resetCatalog(db);
  const brand = await db.brand.create({ data: { name: "Test", slug: "test" } });
  // Awkward MRPs that exercise half-rupee rounding.
  const mrps = [25001, 33333, 99999, 150, 1500000, 47123, 26500, 31, 8888889, 12345];
  let i = 0;
  for (const mrp of mrps) {
    for (const [override, exclude] of [[null, false], [12.5, false], [null, true]] as const) {
      i++;
      await db.product.create({
        data: {
          brandId: brand.id, modelName: `M${i}`, referenceNumber: `R${i}`, slug: `p-${i}`, sku: `SKU-${i}`, description: "x".repeat(20),
          gender: "MEN", mrp, sellingPrice: mrp, caseMaterial: "Steel", caseDiameterMm: 40, dialColour: "Black", strapMaterial: "Leather",
          movement: "AUTOMATIC", discountOverridePct: override, excludeFromGlobalDiscount: exclude,
        },
      });
    }
  }
});
afterAll(() => db.$disconnect());

describe("repriceAll (SQL) matches lib/pricing (JS)", () => {
  for (const pct of [0, 2, 5, 7.5, 33.33, 90]) {
    it(`global ${pct}%`, async () => {
      await db.$transaction((tx) => repriceAll(tx, pct));
      const rows = await db.product.findMany();
      for (const r of rows) {
        const expectedPct = effectiveDiscountPct({ discountOverridePct: r.discountOverridePct === null ? null : Number(r.discountOverridePct), excludeFromGlobalDiscount: r.excludeFromGlobalDiscount }, pct);
        expect(Number(r.effectiveDiscountPct)).toBeCloseTo(expectedPct, 2);
        expect(r.sellingPrice).toBe(sellingPrice(r.mrp, expectedPct));
      }
    });
  }
});

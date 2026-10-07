import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";
import { priceFor } from "@/lib/pricing";
import { firstNumber, normalizeGender, normalizeMovement, parseWarrantyMonths, parseWaterResistanceM, strapTypeOf, tidyLabel, watchTypeOf } from "@/lib/catalog/classify";
import { buildSearchText, nameWithRef, sanitizeText, slugify } from "@/lib/text";

type Tx = Prisma.TransactionClient;

/** Accepts "45.0", "45 mm", "12.5mm" — takes the first number. */
const num = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? null : (firstNumber(v) ?? v)) : v);
const optNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : num(v)), z.coerce.number({ message: "must be a number" }).min(min).max(max).nullable());
const optInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : num(v)), z.coerce.number({ message: "must be a whole number" }).int().min(min).max(max).nullable());
const optStr = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const bool = z.preprocess((v) => (typeof v === "string" ? ["1", "true", "yes", "y"].includes(v.trim().toLowerCase()) : v), z.boolean());

/** Single source of truth for product validation (admin form + bulk importer). */
export const productInputSchema = z
  .object({
    sku: z.string().trim().min(2, "SKU is required").max(64).regex(/^[A-Za-z0-9._\-/]+$/, "SKU: letters, numbers, . _ - / only"),
    brand: z.string().trim().min(1, "Brand is required").max(80),
    modelName: z.string().trim().min(1, "Model name is required").max(120),
    referenceNumber: z.string().trim().min(1, "Reference number is required").max(64),
    slug: optStr(160),
    description: z.string().trim().min(10, "Description should be at least 10 characters").max(8000),
    mrp: z.coerce.number({ message: "MRP must be a number (no ₹ or commas)" }).int("MRP must be a whole number of rupees").min(1, "MRP must be positive").max(100_000_000),
    costPrice: optInt(0, 100_000_000),
    stock: z.coerce.number({ message: "Stock must be a whole number" }).int().min(0, "Stock can't be negative").max(100_000),
    lowStockAt: z.coerce.number().int().min(0).max(1000).default(2),
    collections: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    gender: z.preprocess((v) => (typeof v === "string" ? (normalizeGender(v) ?? v) : v), z.enum(["MEN", "WOMEN", "UNISEX"], { message: "Gender must be Men, Women or Unisex" })),
    caseMaterial: z.string().trim().min(1, "Case material is required").max(80),
    caseDiameterMm: z.preprocess(num, z.coerce.number({ message: "Case diameter must be a number in mm" }).min(10, "Case diameter looks wrong").max(70)),
    caseThicknessMm: optNum(1, 40),
    lugWidthMm: optInt(5, 40),
    dialColour: z.string().trim().min(1, "Dial colour is required").max(40),
    strapMaterial: z.string().trim().min(1, "Strap / bracelet material is required").max(60),
    strapColour: optStr(40),
    movement: z.preprocess((v) => (typeof v === "string" ? (normalizeMovement(v) ?? v) : v), z.enum(["AUTOMATIC", "QUARTZ", "MANUAL", "SOLAR", "KINETIC", "SMART"], { message: "Movement must be Automatic, Quartz, Manual, Solar, Kinetic or Smart" })),
    calibre: optStr(80),
    powerReserveHours: optInt(0, 2000),
    waterResistanceM: z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : parseWaterResistanceM(v)) : v ?? null), z.coerce.number().int().min(0).max(12000).nullable()),
    crystal: optStr(80),
    weightGrams: optInt(1, 2000),
    warrantyMonths: z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : parseWarrantyMonths(v)) : v ?? null), z.coerce.number().int().min(0).max(240).nullable()),
    series: optStr(120),
    watchType: z.preprocess((v) => (typeof v === "string" ? watchTypeOf(v) : v), z.string().max(40).nullable().optional()),
    caseShape: z.preprocess((v) => (typeof v === "string" ? tidyLabel(v) : v), z.string().max(40).nullable().optional()),
    functions: optStr(300),
    specialFeatures: optStr(200),
    brandOrigin: optStr(80),
    boxAndPapers: bool.default(true),
    featured: bool.default(false),
    status: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(["ACTIVE", "DRAFT"]).default("DRAFT")),
    discountOverridePct: optNum(0, 90),
    excludeFromGlobalDiscount: bool.default(false),
    hsnCode: z.preprocess((v) => (v === "" || v == null ? "9102" : String(v)), z.string().regex(/^\d{4,8}$/, "HSN must be 4–8 digits")),
    gstRatePct: z.preprocess((v) => (v === "" || v == null ? 18 : v), z.coerce.number().min(0).max(28)),
    seoTitle: optStr(70),
    seoDescription: optStr(170),
    externalRating: optNum(0, 5),
    externalRatingCount: optInt(0, 100_000_000),
    externalRatingSource: optStr(60),
  })
  .refine((p) => p.externalRating === null || Math.round(p.externalRating * 10) === p.externalRating * 10, {
    message: "externalRating must have at most one decimal",
    path: ["externalRating"],
  });

export type ProductInput = z.output<typeof productInputSchema>;

export async function ensureBrand(tx: Tx, name: string) {
  const clean = sanitizeText(name, 80);
  const existing = await tx.brand.findFirst({ where: { name: { equals: clean, mode: "insensitive" } } });
  if (existing) return existing;
  let slug = slugify(clean) || "brand";
  if (await tx.brand.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  return tx.brand.create({ data: { name: clean, slug } });
}

async function ensureCollections(tx: Tx, names: string[]) {
  const ids: string[] = [];
  for (const raw of names) {
    const name = sanitizeText(raw, 60);
    const slug = slugify(name);
    if (!slug) continue;
    const c = await tx.collection.upsert({ where: { slug }, create: { name, slug }, update: {} });
    ids.push(c.id);
  }
  return ids;
}

async function uniqueSlug(tx: Tx, base: string, excludeId?: string) {
  const root = slugify(base) || "watch";
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

export async function currentGlobalPct(tx: Tx | typeof db = db) {
  const s = await tx.storeSettings.findUnique({ where: { id: 1 }, select: { globalDiscountPct: true } });
  return Number(s?.globalDiscountPct ?? 0);
}

export type ImageInput = { url: string; publicId?: string | null; alt?: string | null; width: number; height: number; blurDataUrl?: string | null };

/**
 * Creates or updates a product. Price is ALWAYS computed here from MRP + discount rules.
 * `partial` lists the columns supplied by a bulk update — only those are written.
 */
export async function writeProduct(
  tx: Tx,
  args: { id?: string; input: ProductInput; images?: ImageInput[]; actorId: string; partialKeys?: (keyof ProductInput)[] },
) {
  const { input, actorId } = args;
  const existing = args.id ? await tx.product.findUnique({ where: { id: args.id }, include: { brand: true } }) : null;
  const pick = <K extends keyof ProductInput>(k: K) => !args.partialKeys || args.partialKeys.includes(k);

  const brand = pick("brand") ? await ensureBrand(tx, input.brand) : existing!.brand;
  if (input.brandOrigin && (!args.partialKeys || args.partialKeys.includes("brandOrigin")) && brand.origin !== input.brandOrigin) {
    await tx.brand.update({ where: { id: brand.id }, data: { origin: sanitizeText(input.brandOrigin, 80) } });
  }
  const globalPct = await currentGlobalPct(tx);
  const mrp = pick("mrp") ? input.mrp : existing!.mrp;
  const override = pick("discountOverridePct") ? input.discountOverridePct : existing?.discountOverridePct != null ? Number(existing.discountOverridePct) : null;
  const exclude = pick("excludeFromGlobalDiscount") ? input.excludeFromGlobalDiscount : (existing?.excludeFromGlobalDiscount ?? false);
  const { pct, price } = priceFor({ mrp, discountOverridePct: override, excludeFromGlobalDiscount: exclude }, globalPct);

  const fields: Partial<Record<keyof ProductInput, unknown>> = {};
  const scalarKeys: (keyof ProductInput)[] = [
    "sku", "modelName", "referenceNumber", "mrp", "costPrice", "stock", "lowStockAt", "gender", "caseMaterial", "caseDiameterMm", "caseThicknessMm",
    "lugWidthMm", "dialColour", "strapMaterial", "strapColour", "movement", "calibre", "powerReserveHours", "waterResistanceM", "crystal",
    "weightGrams", "warrantyMonths", "boxAndPapers", "featured", "status", "discountOverridePct", "excludeFromGlobalDiscount", "hsnCode",
    "gstRatePct", "seoTitle", "seoDescription", "externalRating", "externalRatingCount", "externalRatingSource",
    "series", "watchType", "caseShape", "functions", "specialFeatures",
  ];
  for (const k of scalarKeys) if (pick(k)) fields[k] = input[k] ?? null;
  if (pick("description")) fields.description = sanitizeText(input.description, 8000);
  if (pick("strapMaterial")) (fields as Record<string, unknown>).strapType = strapTypeOf(input.strapMaterial) || null;
  if (pick("modelName")) fields.modelName = sanitizeText(input.modelName, 120);

  const modelName = (fields.modelName as string | undefined) ?? existing!.modelName;
  const referenceNumber = (fields.referenceNumber as string | undefined) ?? existing!.referenceNumber;
  const slug = existing && !(pick("slug") && input.slug) ? existing.slug : await uniqueSlug(tx, input.slug || nameWithRef(modelName, referenceNumber), existing?.id);

  const data = {
    ...(fields as object),
    brandId: brand.id,
    slug,
    sellingPrice: price,
    effectiveDiscountPct: pct,
    searchText: buildSearchText({
      brand: brand.name, modelName, referenceNumber, calibre: (fields.calibre as string | null | undefined) ?? existing?.calibre, sku: (fields.sku as string | undefined) ?? existing?.sku,
      extra: [(fields.series as string | null | undefined) ?? existing?.series ?? "", (fields.watchType as string | null | undefined) ?? existing?.watchType ?? "", (fields.dialColour as string | undefined) ?? existing?.dialColour ?? ""],
    }),
  } as Prisma.ProductUncheckedCreateInput;

  const product = existing
    ? await tx.product.update({ where: { id: existing.id }, data })
    : await tx.product.create({ data: { ...data, stock: input.stock ?? 0 } });

  if (pick("collections") && (!args.partialKeys || input.collections.length)) {
    const ids = await ensureCollections(tx, input.collections);
    await tx.productCollection.deleteMany({ where: { productId: product.id } });
    if (ids.length) await tx.productCollection.createMany({ data: ids.map((collectionId, position) => ({ productId: product.id, collectionId, position })) });
  }

  if (args.images) {
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (args.images.length) {
      await tx.productImage.createMany({
        data: args.images.map((im, position) => ({
          productId: product.id, url: im.url, publicId: im.publicId ?? null, width: im.width, height: im.height,
          blurDataUrl: im.blurDataUrl ?? null, position, alt: im.alt?.trim() || `${brand.name} ${modelName}${position ? ` — view ${position + 1}` : ""}`,
        })),
      });
    }
  }

  if (existing && (existing.sellingPrice !== price || existing.mrp !== mrp)) {
    await tx.priceChangeLog.create({
      data: {
        scope: existing.mrp !== mrp ? "PRODUCT_MRP" : Number(existing.discountOverridePct ?? -1) !== (override ?? -1) ? "PRODUCT_OVERRIDE" : "PRODUCT_EXCLUDE_FLAG",
        actorId, productId: product.id,
        oldValue: existing.mrp !== mrp ? `MRP ₹${existing.mrp.toLocaleString("en-IN")}` : `${Number(existing.effectiveDiscountPct)}%`,
        newValue: existing.mrp !== mrp ? `MRP ₹${mrp.toLocaleString("en-IN")}` : `${pct}%`,
        oldPrice: existing.sellingPrice, newPrice: price,
      },
    });
  }
  return { product, created: !existing, restocked: Boolean(existing && existing.stock === 0 && product.stock > 0) };
}

/** Reprices every product for a global discount in one statement; returns per-product changes. */
export async function repriceAll(tx: Tx, globalPct: number) {
  const before = await tx.product.findMany({ where: { deletedAt: null }, select: { id: true, sellingPrice: true } });
  await tx.$executeRaw`
    UPDATE "Product" p SET
      "effectiveDiscountPct" = e.pct,
      "sellingPrice" = ROUND(("mrp"::numeric * (10000 - ROUND(e.pct * 100))) / 10000)
    FROM (
      SELECT "id",
        CASE WHEN "discountOverridePct" IS NOT NULL THEN LEAST(GREATEST("discountOverridePct", 0), 90)
             WHEN "excludeFromGlobalDiscount" THEN 0
             ELSE ${globalPct}::numeric END AS pct
      FROM "Product"
    ) e
    WHERE p."id" = e."id"`;
  const after = await tx.product.findMany({ where: { deletedAt: null }, select: { id: true, sellingPrice: true } });
  const old = new Map(before.map((p) => [p.id, p.sellingPrice]));
  return after.filter((p) => old.get(p.id) !== p.sellingPrice).map((p) => ({ id: p.id, oldPrice: old.get(p.id)!, newPrice: p.sellingPrice }));
}

export function revalidateCatalog(slugs: string[] = []) {
  revalidateTag(TAGS.products, "max");
  revalidateTag(TAGS.home, "max");
  revalidateTag(TAGS.brands, "max");
  revalidateTag(TAGS.collections, "max");
  revalidateTag(TAGS.demo, "max");
  for (const s of slugs) revalidateTag(TAGS.product(s), "max");
}

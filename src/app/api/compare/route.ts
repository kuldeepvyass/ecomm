import { MOVEMENT_LABEL } from "@/lib/catalog/classify";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { LIVE } from "@/server/catalog/queries";

const MOVEMENT: Record<string, string> = MOVEMENT_LABEL;

export async function GET(req: NextRequest) {
  const parsed = z.array(z.string().cuid()).max(3).safeParse((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean));
  if (!parsed.success) return Response.json({ items: [] }, { status: 400 });
  const rows = await db.product.findMany({
    where: { ...LIVE, id: { in: parsed.data } },
    select: {
      id: true, slug: true, modelName: true, referenceNumber: true, mrp: true, sellingPrice: true, stock: true, caseMaterial: true,
      caseDiameterMm: true, caseThicknessMm: true, watchType: true, caseShape: true, functions: true, dialColour: true, strapMaterial: true, movement: true, calibre: true,
      powerReserveHours: true, waterResistanceM: true, crystal: true, weightGrams: true, warrantyMonths: true, ratingAvg: true, ratingCount: true,
      brand: { select: { name: true, slug: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = parsed.data.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => ({
    id: r.id, href: `/watches/${r.brand.slug}/${r.slug}`, brand: r.brand.name, modelName: r.modelName, image: r.images[0]?.url ?? null,
    mrp: r.mrp, price: r.sellingPrice, ratingAvg: Number(r.ratingAvg), ratingCount: r.ratingCount, referenceNumber: r.referenceNumber,
    caseMaterial: r.caseMaterial, caseDiameterMm: Number(r.caseDiameterMm), caseThicknessMm: r.caseThicknessMm ? Number(r.caseThicknessMm) : null,
    watchType: r.watchType, caseShape: r.caseShape, functions: r.functions, dialColour: r.dialColour, strapMaterial: r.strapMaterial, movement: MOVEMENT[r.movement], calibre: r.calibre, powerReserveHours: r.powerReserveHours,
    waterResistanceM: r.waterResistanceM, crystal: r.crystal, weightGrams: r.weightGrams, warrantyMonths: r.warrantyMonths, stock: r.stock,
  }));
  return Response.json({ items });
}

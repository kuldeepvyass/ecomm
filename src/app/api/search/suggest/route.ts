import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { cardSelect, searchProductIds, toCard } from "@/server/catalog/queries";

const q = z.string().trim().min(1).max(80);

export async function GET(req: NextRequest) {
  const parsed = q.safeParse(req.nextUrl.searchParams.get("q"));
  if (!parsed.success) return Response.json({ products: [], brands: [] });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`search:${ip}`, 120, 60);
  if (!rl.ok) return Response.json({ error: "Too many searches" }, { status: 429 });

  const ids = (await searchProductIds(parsed.data, 6)).slice(0, 6);
  const [rows, brands] = await Promise.all([
    ids.length ? db.product.findMany({ where: { id: { in: ids } }, select: cardSelect }) : [],
    db.brand.findMany({
      where: { name: { contains: parsed.data, mode: "insensitive" }, products: { some: { status: "ACTIVE", deletedAt: null } } },
      select: { name: true, slug: true },
      take: 3,
    }),
  ]);
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  const products = ids.map((id) => byId.get(id)).filter(Boolean).map((p) => ({
    id: p!.id,
    href: `/watches/${p!.brand.slug}/${p!.slug}`,
    brand: p!.brand.name,
    modelName: p!.modelName,
    reference: p!.referenceNumber,
    price: p!.sellingPrice,
    image: p!.images[0] ?? null,
  }));
  return Response.json({ products, brands }, { headers: { "Cache-Control": "public, max-age=60" } });
}

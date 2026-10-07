import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCardsByIds, listProducts } from "@/server/catalog/queries";
import { parseListingParams } from "@/server/catalog/params";

const ids = z.array(z.string().cuid()).max(24);

/** GET ?ids=a,b,c → cards (recently viewed / compare / guest wishlist); otherwise a listing page (infinite scroll). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.has("ids")) {
    const parsed = ids.safeParse((sp.get("ids") ?? "").split(",").filter(Boolean));
    if (!parsed.success) return Response.json({ items: [] }, { status: 400 });
    return Response.json({ items: await getCardsByIds(parsed.data) });
  }
  const { filters, sort } = parseListingParams(Object.fromEntries(sp.entries()));
  const cursor = sp.get("cursor");
  const page = await listProducts({ filters, sort, cursor: cursor && /^c[a-z0-9]{20,}$/.test(cursor) ? cursor : null });
  return Response.json(page, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}

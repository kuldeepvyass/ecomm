import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** Popularity signal; rate-limited per IP+product so it can't be pumped. */
export async function POST(req: Request, ctx: RouteContext<"/api/products/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^c[a-z0-9]{20,}$/.test(id)) return new Response(null, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`view:${ip}:${id}`, 1, 3600);
  if (rl.ok) await db.product.updateMany({ where: { id }, data: { viewCount: { increment: 1 } } });
  return new Response(null, { status: 204 });
}

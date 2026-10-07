import { z } from "zod";
import { listReviews } from "@/server/reviews/queries";

const q = z.object({
  sort: z.enum(["helpful", "newest", "highest", "lowest"]).catch("helpful"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
});

export async function GET(req: Request, ctx: RouteContext<"/api/products/[id]/reviews">) {
  const { id } = await ctx.params;
  if (!/^c[a-z0-9]{20,}$/.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { sort, page, rating } = q.parse(sp);
  return Response.json(await listReviews(id, sort, page, rating));
}

import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { revalidateCatalog } from "@/server/catalog/admin";

/**
 * Refreshes every cached catalogue page after data was changed outside the app (deploy.sh copy-catalog).
 * Authorised by the AUTH_SECRET itself, which only the server knows; anything else gets a plain 404.
 */
export async function POST(req: Request) {
  const secret = Buffer.from(process.env.AUTH_SECRET ?? "");
  const token = Buffer.from(req.headers.get("x-revalidate-token") ?? "");
  if (secret.length === 0 || token.length !== secret.length || !timingSafeEqual(token, secret)) {
    return new Response("Not found", { status: 404 });
  }
  revalidateCatalog();
  revalidateTag(TAGS.settings, "max");
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}

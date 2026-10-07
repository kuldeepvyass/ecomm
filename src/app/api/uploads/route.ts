import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/logger";
import { storeImage } from "@/server/uploads";

/** multipart/form-data: file + purpose. Customers may upload review photos and payment screenshots; the rest is admin-only. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = String(form?.get("purpose") ?? "reviews");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const folder = (["products", "reviews", "banners", "brand", "payments"] as const).find((f) => f === purpose);
  if (!folder) return Response.json({ error: "Bad purpose" }, { status: 400 });
  if (folder !== "reviews" && folder !== "payments" && session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const rl = await rateLimit(`upload:${session.user.id}`, session.user.role === "ADMIN" ? 600 : 20, 3600);
  if (!rl.ok) return Response.json({ error: "Too many uploads" }, { status: 429 });
  try {
    const img = await storeImage(Buffer.from(await file.arrayBuffer()), folder);
    return Response.json(img);
  } catch (e) {
    reportError(e, { where: "upload" });
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}

import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ addresses: [] }, { status: 401 });
  const addresses = await db.address.findMany({ where: { userId: session.user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return Response.json({ addresses }, { headers: { "Cache-Control": "private, no-store" } });
}

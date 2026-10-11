import path from "node:path";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for the deploy script and uptime monitors. No secrets, no PII. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // On the VPS the app runs from releases/<id> (via the `current` link), so the folder name is the release.
    return Response.json({ ok: true, release: path.basename(process.cwd()) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

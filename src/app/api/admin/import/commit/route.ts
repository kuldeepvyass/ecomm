import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { reportError } from "@/lib/logger";
import { logAudit } from "@/server/audit";
import { adminOrResponse } from "@/server/admin-route";
import { revalidateCatalog, writeProduct, type ImageInput } from "@/server/catalog/admin";
import { commitBody, type RowResult } from "@/server/catalog/import";
import { notifyBackInStock } from "@/server/orders/service";

export const maxDuration = 300;

/**
 * Commits rows [from, to) of a previewed job using the SERVER-validated data stored at preview time.
 * The client calls this in small chunks so large imports never hit a function timeout.
 */
export async function POST(req: Request) {
  const a = await adminOrResponse();
  if ("error" in a) return a.error;
  const parsed = commitBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { jobId, from, to, imageMap } = parsed.data;
  const dropped = new Set(parsed.data.dropImages);

  const job = await db.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.actorId !== a.user.id) return Response.json({ error: "Import not found" }, { status: 404 });
  if (job.status !== "PREVIEW" && job.status !== "RUNNING") return Response.json({ error: "This import has already finished." }, { status: 409 });
  const rows = (job.rowResults ?? []) as unknown as RowResult[];
  if (job.status === "PREVIEW") await db.importJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });

  const lowerMap = new Map(Object.entries(imageMap).map(([k, v]) => [k.toLowerCase(), v]));
  const slugs: string[] = [];
  const restocked: string[] = [];

  for (let i = from; i < Math.min(to, rows.length); i++) {
    const r = rows[i];
    if (r.outcome) continue; // idempotent on retry
    try {
      if (r.action === "error") { r.outcome = "failed"; r.outcomeReason = r.errors?.join("; "); continue; }
      if (r.action === "skip") { r.outcome = "skipped"; r.outcomeReason = r.reason; continue; }
      if (r.action === "delete" || r.action === "deactivate") {
        const p = await db.product.update({ where: { id: r.productId! }, data: r.action === "delete" ? { deletedAt: new Date(), status: "DRAFT" } : { status: "DRAFT" } });
        slugs.push(p.slug);
        r.outcome = r.action === "delete" ? "deleted" : "deactivated";
        continue;
      }
      let images: ImageInput[] | undefined;
      if (r.images && dropped.size) {
        const kept = r.images.filter((u) => !dropped.has(u));
        // Every link broken → keep the product hidden until it gets a working photo.
        if (kept.length === 0 && r.images.length > 0 && r.data && r.action === "create") r.data = { ...r.data, status: "DRAFT" };
        r.images = kept;
      }
      if (r.images && r.images.length) {
        images = [];
        for (const ref of r.images) {
          if (/^https?:\/\//i.test(ref)) {
            // Linked, not downloaded: the image stays on its original host so our storage never grows.
            images.push({ url: ref, publicId: null, width: 1000, height: 1000, blurDataUrl: null });
          } else {
            const hit = lowerMap.get(ref.toLowerCase());
            if (!hit) throw new Error(`Image "${ref}" was not uploaded from the ZIP`);
            images.push(hit);
          }
        }
      }
      const res = await db.$transaction((tx) => writeProduct(tx, { id: r.productId, input: r.data!, images, actorId: a.user.id, partialKeys: r.action === "update" ? r.partialKeys : undefined }));
      slugs.push(res.product.slug);
      if (res.restocked) restocked.push(res.product.id);
      r.productId = res.product.id;
      r.outcome = res.created ? "created" : "updated";
    } catch (e) {
      r.outcome = "failed";
      r.outcomeReason = e instanceof Error ? e.message.slice(0, 300) : "Failed";
      reportError(e, { where: "import.commit", row: r.row });
    }
  }

  const done = to >= rows.length;
  const tally = (o: RowResult["outcome"]) => rows.filter((r) => r.outcome === o).length;
  const updated = await db.importJob.update({
    where: { id: jobId },
    data: {
      rowResults: rows as unknown as Prisma.InputJsonValue,
      createdCount: tally("created"),
      updatedCount: tally("updated") + tally("deleted") + tally("deactivated"),
      skippedCount: tally("skipped"),
      failedCount: tally("failed"),
      ...(done ? { status: "COMPLETED", finishedAt: new Date() } : {}),
    },
  });
  if (done) {
    await logAudit({ actorId: a.user.id, action: `catalog.${job.kind.toLowerCase()}`, entityType: "ImportJob", entityId: jobId, diff: { created: [null, updated.createdCount], updated: [null, updated.updatedCount], skipped: [null, updated.skippedCount], failed: [null, updated.failedCount] } });
  }
  revalidateCatalog(slugs);
  if (restocked.length) void notifyBackInStock(restocked);
  return Response.json({
    done,
    processed: Math.min(to, rows.length),
    total: rows.length,
    summary: { created: updated.createdCount, updated: updated.updatedCount, skipped: updated.skippedCount, failed: updated.failedCount },
    failures: done ? rows.filter((r) => r.outcome === "failed").map((r) => ({ row: r.row, sku: r.sku, reason: r.outcomeReason })) : undefined,
  });
}

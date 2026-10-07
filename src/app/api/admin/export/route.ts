import { logAudit } from "@/server/audit";
import { adminOrResponse } from "@/server/admin-route";
import { buildWorkbook, exportRows, toCsv } from "@/server/catalog/import";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const a = await adminOrResponse();
  if ("error" in a) return a.error;
  const rows = await exportRows();
  const csv = new URL(req.url).searchParams.get("format") === "csv";
  const stamp = new Date().toISOString().slice(0, 10);
  await db.importJob.create({ data: { kind: "EXPORT", status: "COMPLETED", fileName: `catalog-${stamp}.${csv ? "csv" : "xlsx"}`, actorId: a.user.id, totalRows: rows.length, finishedAt: new Date() } });
  await logAudit({ actorId: a.user.id, action: "catalog.export", entityType: "Product", diff: { rows: [null, rows.length] } });
  if (csv) return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="catalog-${stamp}.csv"` } });
  const buf = await buildWorkbook(rows, true);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="catalog-${stamp}.xlsx"` } });
}

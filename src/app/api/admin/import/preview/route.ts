import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { reportError } from "@/lib/logger";
import { adminOrResponse } from "@/server/admin-route";
import { parseSpreadsheet, validateRows, type RawRow } from "@/server/catalog/import";

export const maxDuration = 120;

/** Parses + validates an upload and stores a PREVIEW job. Nothing in the catalog changes. */
export async function POST(req: Request) {
  const a = await adminOrResponse();
  if ("error" in a) return a.error;
  try {
    const form = await req.formData();
    const kind = String(form.get("kind") ?? "IMPORT") as "IMPORT" | "BULK_UPDATE" | "BULK_DELETE";
    if (!["IMPORT", "BULK_UPDATE", "BULK_DELETE"].includes(kind)) return Response.json({ error: "Bad kind" }, { status: 400 });
    const deleteMode = form.get("deleteMode") === "deactivate" ? "deactivate" : "delete";
    const zipNames = JSON.parse(String(form.get("zipNames") ?? "[]")) as string[];
    const skuList = String(form.get("skuList") ?? "");
    const file = form.get("file");

    let rows: RawRow[];
    let fileName: string;
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Spreadsheet must be under 8 MB (upload images in the ZIP, not inside the sheet)." }, { status: 400 });
      fileName = file.name;
      rows = (await parseSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name)).rows;
    } else if (kind === "BULK_DELETE" && skuList.trim()) {
      fileName = "pasted-sku-list.txt";
      rows = skuList.split(/[\s,;]+/).filter(Boolean).map((sku) => ({ sku }));
    } else {
      return Response.json({ error: "Choose a CSV or XLSX file." }, { status: 400 });
    }

    const results = await validateRows(kind, rows, {
      zipNames: Array.isArray(zipNames) ? zipNames.slice(0, 5000) : [],
      deleteMode,
      defaultStock: Math.max(0, Math.min(9999, Math.floor(Number(form.get("defaultStock") ?? 1)) || 0)),
      publish: form.get("publish") !== "false",
      ratingSource: String(form.get("ratingSource") ?? "").trim().slice(0, 60) || null,
      checkImages: form.get("checkImages") === "server",
    });
    const count = (k: string) => results.filter((r) => r.action === k).length;
    const job = await db.importJob.create({
      data: {
        kind, status: "PREVIEW", fileName, actorId: a.user.id, totalRows: results.length,
        rowResults: results as unknown as Prisma.InputJsonValue,
      },
    });
    return Response.json({
      jobId: job.id,
      summary: { total: results.length, create: count("create"), update: count("update"), delete: count("delete") + count("deactivate"), skip: count("skip"), error: count("error"), warning: results.filter((r) => r.warnings?.length).length },
      rows: results.map(({ data, ...r }) => ({ ...r, name: data ? `${data.brand} ${data.modelName}` : undefined, mrp: data?.mrp })),
    });
  } catch (e) {
    reportError(e, { where: "import.preview" });
    return Response.json({ error: e instanceof Error ? e.message : "Could not read the file." }, { status: 400 });
  }
}

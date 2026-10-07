import { adminOrResponse } from "@/server/admin-route";
import { COLUMNS, buildWorkbook, toCsv } from "@/server/catalog/import";

export async function GET(req: Request) {
  const a = await adminOrResponse();
  if ("error" in a) return a.error;
  const example = Object.fromEntries(COLUMNS.map((c) => [c.key, c.example]));
  const csv = new URL(req.url).searchParams.get("format") === "csv";
  if (csv) return new Response(toCsv([example]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="maison-product-template.csv"' } });
  const buf = await buildWorkbook([example], true);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="maison-product-template.xlsx"' } });
}

import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { z } from "zod";
import { normalizeMovement } from "@/lib/catalog/classify";
import { db } from "@/lib/db";
import { productInputSchema, type ProductInput } from "./admin";

/** Template columns, in order. Keys match productInputSchema (+ images). */
export const COLUMNS: { key: keyof ProductInput | "images"; required: "create" | "no"; help: string; example: string }[] = [
  { key: "sku", required: "create", help: "Unique stock-keeping unit. Used to match rows on update/delete.", example: "MH-AQ-001" },
  { key: "brand", required: "create", help: "Brand / maison name. New brands are created automatically.", example: "Aurèle & Fils" },
  { key: "modelName", required: "create", help: "Model name.", example: "Abysse 300 Diver" },
  { key: "referenceNumber", required: "create", help: "Manufacturer reference.", example: "AF-300.N" },
  { key: "slug", required: "no", help: "URL slug. Blank = generated from model + reference.", example: "" },
  { key: "description", required: "create", help: "Product description (plain text).", example: "ISO-rated to 300 metres with a ceramic bezel." },
  { key: "mrp", required: "create", help: "MRP in whole rupees, GST-inclusive. No commas or ₹.", example: "320000" },
  { key: "costPrice", required: "no", help: "Your cost (never shown to customers).", example: "210000" },
  { key: "stock", required: "create", help: "Units in stock (0 or more).", example: "5" },
  { key: "lowStockAt", required: "no", help: "Show 'Only N left' at or below this. Default 2.", example: "2" },
  { key: "collections", required: "no", help: "Pipe-separated, e.g. Dive|Limited Edition. New ones are created.", example: "Dive" },
  { key: "series", required: "no", help: "The brand's product line / collection name, e.g. \"Armani Exchange Chronograph\". Shown on the product page.", example: "Abysse" },
  { key: "watchType", required: "no", help: "Chronograph, Analog, Diver, Dress, Digital, Smart… Used as a filter; Chronograph/Diver/Dress also join the curated collections.", example: "Diver" },
  { key: "gender", required: "create", help: "Men, Women or Unisex.", example: "Men" },
  { key: "caseMaterial", required: "create", help: "e.g. Stainless steel, Stainless steel black IP.", example: "Stainless steel" },
  { key: "caseShape", required: "no", help: "Round, Square, Rectangular, Tonneau…", example: "Round" },
  { key: "caseDiameterMm", required: "create", help: "Case diameter in mm (decimals OK).", example: "42" },
  { key: "caseThicknessMm", required: "no", help: "Case thickness in mm.", example: "13.8" },
  { key: "lugWidthMm", required: "no", help: "Lug width in mm.", example: "22" },
  { key: "dialColour", required: "create", help: "Dial colour.", example: "Black" },
  { key: "strapMaterial", required: "create", help: "e.g. Steel bracelet, Alligator leather, Rubber.", example: "Rubber" },
  { key: "strapColour", required: "no", help: "Strap colour.", example: "Black" },
  { key: "movement", required: "create", help: "Automatic, Quartz, Manual (hand-wound), Solar (Eco-Drive), Kinetic or Smart. Descriptions like \"Japanese quartz\" are understood.", example: "Automatic" },
  { key: "calibre", required: "no", help: "Movement calibre.", example: "AF 300" },
  { key: "powerReserveHours", required: "no", help: "Power reserve in hours.", example: "70" },
  { key: "waterResistanceM", required: "no", help: "Metres, or text like \"50 m (5 ATM)\" / \"10 ATM\".", example: "300 m (30 ATM)" },
  { key: "crystal", required: "no", help: "Crystal type.", example: "Sapphire" },
  { key: "weightGrams", required: "no", help: "Weight in grams.", example: "152" },
  { key: "warrantyMonths", required: "no", help: "Months, or text like \"2 years\".", example: "3 years" },
  { key: "functions", required: "no", help: "e.g. \"Chronograph (1/10 s), small seconds, date\".", example: "Date, unidirectional bezel" },
  { key: "specialFeatures", required: "no", help: "A short highlight shown on the product page.", example: "Ceramic bezel, helium escape valve" },
  { key: "brandOrigin", required: "no", help: "Where the brand is from, e.g. \"Switzerland\" — saved on the brand.", example: "Switzerland" },
  { key: "boxAndPapers", required: "no", help: "TRUE/FALSE. Default TRUE.", example: "TRUE" },
  { key: "featured", required: "no", help: "TRUE/FALSE — show on homepage.", example: "FALSE" },
  { key: "status", required: "no", help: "ACTIVE (live) or DRAFT (hidden). Default DRAFT.", example: "ACTIVE" },
  { key: "discountOverridePct", required: "no", help: "Product's own discount %, overrides the global discount. Blank = follow global.", example: "" },
  { key: "excludeFromGlobalDiscount", required: "no", help: "TRUE to keep this product at MRP when a global discount runs.", example: "FALSE" },
  { key: "hsnCode", required: "no", help: "HSN code. Default 9102 (wrist watches).", example: "9102" },
  { key: "gstRatePct", required: "no", help: "GST rate %. Default 18.", example: "18" },
  { key: "seoTitle", required: "no", help: "SEO title (≤ 70 chars).", example: "" },
  { key: "seoDescription", required: "no", help: "SEO description (≤ 170 chars).", example: "" },
  { key: "externalRating", required: "no", help: "OPTIONAL real rating copied from a marketplace, 0–5 with one decimal. Never invent this.", example: "" },
  { key: "externalRatingCount", required: "no", help: "Number of ratings at that source.", example: "" },
  { key: "externalRatingSource", required: "no", help: "Optional source name, e.g. Amazon.in. Leave blank to show just the stars and count (or set one for the whole file in the importer).", example: "" },
  { key: "images", required: "no", help: "Pipe-separated image links (stored as links — nothing is downloaded) and/or file names inside a ZIP. First = cover. You can instead use separate image1…image4 columns.", example: "https://cdn.example.com/abysse-front.jpg|https://cdn.example.com/abysse-side.jpg" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Column names from other datasets (e.g. your watch dataset) → store fields. */
const ALIASES: Record<string, string> = {
  watchid: "sku", productid: "sku", id: "sku",
  modelname: "modelName", name: "modelName", title: "modelName",
  modelno: "referenceNumber", modelnumber: "referenceNumber", reference: "referenceNumber", ref: "referenceNumber",
  collection: "series", line: "series", series: "series",
  watchtype: "watchType", type: "watchType",
  casesizemm: "caseDiameterMm", casesize: "caseDiameterMm", diameter: "caseDiameterMm", diametermm: "caseDiameterMm",
  casethicknessmm: "caseThicknessMm", thickness: "caseThicknessMm",
  casematerial: "caseMaterial", caseshape: "caseShape", shape: "caseShape",
  dialcolour: "dialColour", dialcolor: "dialColour",
  strap: "strapMaterial", strapmaterial: "strapMaterial", bracelet: "strapMaterial", strapcolour: "strapColour", strapcolor: "strapColour",
  waterresistance: "waterResistanceM", waterresistancem: "waterResistanceM",
  warranty: "warrantyMonths", functions: "functions", specialfeatures: "specialFeatures", features: "specialFeatures",
  brandorigin: "brandOrigin", origin: "brandOrigin",
  price: "mrp", priceinr: "mrp", mrpinr: "mrp",
  rating: "externalRating", ratingcount: "externalRatingCount", reviews: "externalRatingCount", ratingsource: "externalRatingSource",
  image1: "image1", image2: "image2", image3: "image3", image4: "image4", image5: "image5", image6: "image6",
  // deliberately ignored
  segment: "?segment", imagecount: "?imagecount", datasetimagefile: "?datasetimagefile",
};
const HEADER_MAP = new Map<string, string>([...Object.entries(ALIASES), ...COLUMNS.map((c) => [norm(c.key), c.key] as [string, string])]);

export type RawRow = Record<string, string>;

export async function parseSpreadsheet(buf: Buffer, fileName: string): Promise<{ headers: string[]; rows: RawRow[] }> {
  const lower = fileName.toLowerCase();
  let table: string[][] = [];
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = buf.toString("utf8").replace(/^﻿/, "");
    const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    table = res.data;
  } else if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets.find((w) => w.name.toLowerCase() === "products") ?? wb.worksheets[0];
    if (!ws) throw new Error("The workbook has no sheets.");
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value as unknown;
        let s = "";
        if (v === null || v === undefined) s = "";
        else if (typeof v === "object" && v && "text" in v) s = String((v as { text: unknown }).text);
        else if (typeof v === "object" && v && "result" in v) s = String((v as { result: unknown }).result ?? "");
        else if (typeof v === "object" && v && "richText" in v) s = (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
        else if (typeof v === "object" && v && "hyperlink" in v) s = String((v as { hyperlink: unknown }).hyperlink);
        else s = String(v);
        vals[col - 1] = s;
      });
      table.push(vals);
    });
  } else {
    throw new Error("Upload a .csv or .xlsx file.");
  }
  if (table.length < 2) throw new Error("The file has no data rows.");
  const rawHeaders = table[0].map((h) => String(h ?? "").trim());
  const headers = rawHeaders.map((h) => HEADER_MAP.get(norm(h)) ?? `?${h}`);
  const rows = table.slice(1).map((cells) => {
    const r: RawRow = {};
    const extraImages: string[] = [];
    headers.forEach((h, i) => {
      if (h.startsWith("?")) return;
      const v = String(cells[i] ?? "").trim();
      if (/^image\d$/.test(h)) {
        if (v) extraImages.push(v);
      } else r[h] = v;
    });
    if (extraImages.length) r.images = [r.images, ...extraImages].filter(Boolean).join("|");
    return r;
  }).filter((r) => Object.values(r).some((v) => v !== ""));
  if (rows.length > 5000) throw new Error("Maximum 5,000 rows per import.");
  return { headers, rows };
}

export type RowResult = {
  row: number; // spreadsheet row number (header = 1)
  sku: string;
  action: "create" | "update" | "skip" | "delete" | "deactivate" | "error";
  reason?: string;
  errors?: string[];
  warnings?: string[];
  data?: ProductInput;
  partialKeys?: (keyof ProductInput)[];
  images?: string[]; // as written in the sheet; resolved at commit
  productId?: string;
  outcome?: "created" | "updated" | "skipped" | "deleted" | "deactivated" | "failed";
  outcomeReason?: string;
};

const EXISTING_SELECT = {
  id: true, sku: true, modelName: true, referenceNumber: true, slug: true, description: true, mrp: true, costPrice: true, stock: true, lowStockAt: true,
  gender: true, caseMaterial: true, caseDiameterMm: true, caseThicknessMm: true, lugWidthMm: true, dialColour: true, strapMaterial: true, strapColour: true,
  movement: true, calibre: true, powerReserveHours: true, waterResistanceM: true, crystal: true, weightGrams: true, warrantyMonths: true, boxAndPapers: true,
  featured: true, status: true, discountOverridePct: true, excludeFromGlobalDiscount: true, hsnCode: true, gstRatePct: true, seoTitle: true, seoDescription: true,
  externalRating: true, externalRatingCount: true, externalRatingSource: true, deletedAt: true,
  series: true, watchType: true, caseShape: true, functions: true, specialFeatures: true,
  brand: { select: { name: true, origin: true } },
  collections: { select: { collection: { select: { name: true } } } },
  images: { orderBy: { position: "asc" as const }, select: { url: true } },
};

type Existing = NonNullable<Awaited<ReturnType<typeof loadExisting>>>[number];
async function loadExisting(skus: string[]) {
  return db.product.findMany({ where: { sku: { in: skus } }, select: EXISTING_SELECT });
}

function existingToRaw(p: Existing): Record<string, unknown> {
  const { brand, collections, images: _i, deletedAt: _d, id: _id, ...rest } = p;
  const out: Record<string, unknown> = { ...rest, brand: brand.name, brandOrigin: brand.origin, collections: collections.map((c) => c.collection.name) };
  for (const k of ["caseDiameterMm", "caseThicknessMm", "discountOverridePct", "gstRatePct", "externalRating"]) {
    if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]);
  }
  return out;
}

const splitList = (s: string) => s.split(/[|\n]/).map((x) => x.trim()).filter(Boolean);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export type ImportOptions = {
  zipNames: string[];
  deleteMode?: "delete" | "deactivate";
  /** Stock for NEW products when the file has no stock column (datasets usually don't). */
  defaultStock?: number;
  /** New products go live (ACTIVE) unless the file says otherwise; products without images stay DRAFT. */
  publish?: boolean;
  /** Label for imported ratings that have no source column, e.g. "Amazon.in". Blank = no label. */
  ratingSource?: string | null;
  /**
   * Server-side link check (off by default). Many retailers block automated requests but serve
   * browsers fine, so the importer UI checks links in the admin's browser instead — far more accurate.
   */
  checkImages?: boolean;
};

/**
 * Curated collections a new row joins automatically (when the file has no collections column):
 * by watch type, movement and brand origin — so the homepage collections fill themselves.
 */
function collectionsFor(row: Record<string, unknown>): string[] {
  const type = String(row.watchType ?? "").toLowerCase();
  const out: string[] = [];
  if (type.includes("chrono")) out.push("Chronograph");
  if (type.includes("div")) out.push("Dive");
  if (type.includes("dress")) out.push("Dress");
  if (/smart|gps|fitness/.test(type)) out.push("Smartwatches");
  if (normalizeMovement(String(row.movement ?? "")) === "AUTOMATIC") out.push("Automatic");
  if (/swiss|switzerland/i.test(String(row.brandOrigin ?? "")) || /^swiss\b/i.test(String(row.movement ?? ""))) out.push("Swiss Made");
  return out;
}

/** Model numbers like "3575xxx (variant TBC)" are notes, not references customers should see. */
const PLACEHOLDER_REF = /x{3,}|\btb[ac]\b|\bvariant\b|\bn\/?a\b|unknown|^-+$/i;

/**
 * Each brand's reference numbers are unique in the catalogue. Catch clashes at preview time —
 * within the file and against existing products — instead of failing halfway through the save.
 */
async function flagDuplicateReferences(results: RowResult[]) {
  const live = results.filter((r) => (r.action === "create" || r.action === "update") && r.data);
  const keyOf = (brand: string, ref: string) => `${brand.trim().toLowerCase()}|${ref.trim().toLowerCase()}`;
  const firstRow = new Map<string, RowResult>();
  for (const r of live) {
    const k = keyOf(r.data!.brand, r.data!.referenceNumber);
    const prev = firstRow.get(k);
    if (prev) Object.assign(r, { action: "error", errors: [`Same brand + model number as row ${prev.row} (${prev.sku}) — give each watch its own model number`], data: undefined });
    else firstRow.set(k, r);
  }
  if (!firstRow.size) return;
  const clashes = await db.product.findMany({
    where: { OR: [...firstRow.values()].map((r) => ({ referenceNumber: { equals: r.data!.referenceNumber, mode: "insensitive" as const }, brand: { name: { equals: r.data!.brand, mode: "insensitive" as const } } })) },
    select: { id: true, sku: true, referenceNumber: true, brand: { select: { name: true } } },
  });
  for (const c of clashes) {
    const r = firstRow.get(keyOf(c.brand.name, c.referenceNumber));
    if (r && r.productId !== c.id && r.sku.toLowerCase() !== c.sku.toLowerCase()) {
      Object.assign(r, { action: "error", errors: [`${c.brand.name} ${c.referenceNumber} already exists as SKU ${c.sku}`], data: undefined });
    }
  }
}

/** Validates every row; nothing is written. */
export async function validateRows(kind: "IMPORT" | "BULK_UPDATE" | "BULK_DELETE", rows: RawRow[], opts: ImportOptions): Promise<RowResult[]> {
  const skus = rows.map((r) => r.sku).filter(Boolean);
  const existing = new Map((await loadExisting(skus)).map((p) => [p.sku.toLowerCase(), p]));
  const zip = new Set(opts.zipNames.map((n) => n.toLowerCase()));
  const seen = new Set<string>();
  const results: RowResult[] = [];

  rows.forEach((raw, i) => {
    const rowNo = i + 2;
    const sku = (raw.sku ?? "").trim();
    if (!sku) return results.push({ row: rowNo, sku: "", action: "error", errors: ["sku is required"] });
    const key = sku.toLowerCase();
    if (seen.has(key)) return results.push({ row: rowNo, sku, action: "error", errors: [`Duplicate SKU in file (already on an earlier row)`] });
    seen.add(key);
    const ex = existing.get(key);

    if (kind === "BULK_DELETE") {
      if (!ex) return results.push({ row: rowNo, sku, action: "skip", reason: "SKU not found" });
      return results.push({ row: rowNo, sku, action: opts.deleteMode === "deactivate" ? "deactivate" : "delete", productId: ex.id });
    }
    if (kind === "BULK_UPDATE" && !ex) return results.push({ row: rowNo, sku, action: "skip", reason: "SKU not found — use Import to create new products" });

    const provided = Object.fromEntries(Object.entries(raw).filter(([k, v]) => v !== "" && k !== "images")) as Record<string, unknown>;
    if (typeof provided.collections === "string") provided.collections = splitList(provided.collections as string);
    for (const k of ["mrp", "costPrice", "stock"]) if (typeof provided[k] === "string") provided[k] = (provided[k] as string).replace(/[₹,\s]|rs\.?|inr/gi, "").replace(/\.\d+$/, "");
    if (provided.externalRating !== undefined && !provided.externalRatingSource && opts.ratingSource) provided.externalRatingSource = opts.ratingSource;
    const warnings: string[] = [];
    if (typeof provided.referenceNumber === "string" && PLACEHOLDER_REF.test(provided.referenceNumber)) {
      warnings.push(`Model number "${provided.referenceNumber}" looks like a placeholder — using ${sku} as the reference`);
      provided.referenceNumber = sku;
    }
    const imageList = raw.images ? splitList(raw.images) : [];
    if (!ex) {
      if (provided.stock === undefined) provided.stock = String(opts.defaultStock ?? 1);
      if (provided.status === undefined) provided.status = opts.publish === false ? "DRAFT" : "ACTIVE";
      if (provided.collections === undefined) provided.collections = collectionsFor(provided);
      if (imageList.length === 0 && provided.status === "ACTIVE") {
        provided.status = "DRAFT";
        warnings.push("No images — saved as a draft until you add one");
      }
    }
    const merged = ex ? { ...existingToRaw(ex), ...provided } : provided;
    const parsed = productInputSchema.safeParse(merged);
    const imgErrors = imageList.filter((s) => !/^https?:\/\//i.test(s) && !zip.has(s.toLowerCase())).map((s) => `Image "${s}" is neither a URL nor a file in the ZIP`);
    if (!parsed.success || imgErrors.length) {
      const errs = parsed.success ? [] : parsed.error.issues.map((iss) => `${iss.path.join(".") || "row"}: ${iss.message}`);
      return results.push({ row: rowNo, sku, action: "error", errors: [...errs, ...imgErrors] });
    }
    const partialKeys = Object.keys(provided) as (keyof ProductInput)[];
    if (ex) {
      const before = existingToRaw(ex);
      const changed = partialKeys.filter((k) => !same(before[k], (parsed.data as Record<string, unknown>)[k]));
      const imagesChanged = imageList.length > 0 && !same(imageList, ex.images.map((im) => im.url));
      if (!changed.length && !imagesChanged) return results.push({ row: rowNo, sku, action: "skip", reason: "No changes", productId: ex.id });
      return results.push({ row: rowNo, sku, action: "update", data: parsed.data, partialKeys: changed, images: imagesChanged ? imageList : undefined, productId: ex.id, warnings });
    }
    results.push({ row: rowNo, sku, action: "create", data: parsed.data, images: imageList, warnings });
  });

  await flagDuplicateReferences(results);
  if (opts.checkImages) await checkImageLinks(results);
  return results;
}

/**
 * Images are stored as links (nothing is downloaded), so we check each link loads now rather than
 * showing customers a broken picture later. Failures are warnings — some sites block automated checks
 * but still work in browsers.
 */
async function checkImageLinks(results: RowResult[]) {
  const urls = [...new Set(results.flatMap((r) => (r.action === "create" || r.action === "update" ? r.images ?? [] : [])).filter((u) => /^https?:\/\//i.test(u)))].slice(0, 3000);
  const status = new Map<string, string | null>();
  const queue = [...urls];
  const probe = async (url: string) => {
    const headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", Accept: "image/avif,image/webp,image/*,*/*;q=0.8" };
    try {
      let res = await fetch(url, { method: "HEAD", headers, redirect: "follow", signal: AbortSignal.timeout(6000) });
      if (res.status === 405 || res.status === 403 || res.status === 400) res = await fetch(url, { headers: { ...headers, Range: "bytes=0-0" }, redirect: "follow", signal: AbortSignal.timeout(6000) });
      const type = res.headers.get("content-type") ?? "";
      if (res.status >= 400) return `link returned ${res.status}`;
      if (type && !type.startsWith("image/") && !type.includes("octet-stream")) return `link isn't an image (${type.split(";")[0]})`;
      return null;
    } catch {
      return "link didn't respond";
    }
  };
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (queue.length) {
      const u = queue.shift()!;
      status.set(u, await probe(u));
    }
  }));
  for (const r of results) {
    (r.images ?? []).forEach((u, i) => {
      const problem = status.get(u);
      if (problem) (r.warnings ??= []).push(`Image ${i + 1}: ${problem}`);
    });
  }
}

export const commitBody = z.object({
  jobId: z.string().cuid(),
  from: z.number().int().min(0),
  to: z.number().int().min(1),
  imageMap: z.record(z.string(), z.object({ url: z.string(), publicId: z.string().nullable().optional(), width: z.number(), height: z.number(), blurDataUrl: z.string().nullable().optional() })).default({}),
  /** Image links the admin's browser couldn't load — left out of the products. */
  dropImages: z.array(z.string().max(2000)).max(10000).default([]),
});

/** Export: every product (incl. drafts, excl. trash) in template order. */
export async function exportRows() {
  const products = await db.product.findMany({ where: { deletedAt: null }, orderBy: [{ brand: { name: "asc" } }, { modelName: "asc" }], select: EXISTING_SELECT });
  return products.map((p) => {
    const raw = existingToRaw(p);
    const row: Record<string, string> = {};
    for (const c of COLUMNS) {
      if (c.key === "images") row.images = p.images.map((i) => i.url).join("|");
      else if (c.key === "collections") row.collections = (raw.collections as string[]).join("|");
      else row[c.key] = raw[c.key] === null || raw[c.key] === undefined ? "" : typeof raw[c.key] === "boolean" ? (raw[c.key] ? "TRUE" : "FALSE") : String(raw[c.key]);
    }
    return row;
  });
}

export async function buildWorkbook(rows: Record<string, string>[], withInstructions: boolean) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Maison Horlogère";
  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.key, key: c.key, width: Math.max(12, Math.min(40, c.key.length + 6)) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EEE6" } };
  for (const r of rows) ws.addRow(r);
  if (withInstructions) {
    const help = wb.addWorksheet("Instructions");
    help.columns = [{ header: "Column", key: "k", width: 26 }, { header: "Required for new products", key: "r", width: 26 }, { header: "What to enter", key: "h", width: 90 }];
    help.getRow(1).font = { bold: true };
    for (const c of COLUMNS) help.addRow({ k: c.key, r: c.required === "create" ? "Yes" : "No", h: c.help });
    help.addRow({});
    help.addRow({ k: "Tips", h: "Import = create new SKUs and update existing ones. Bulk update = only change the columns you fill in (blank cells are left unchanged). Prices you enter are MRP; selling prices are always calculated by the store from the discount rules." });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toCsv(rows: Record<string, string>[]) {
  return "﻿" + Papa.unparse({ fields: COLUMNS.map((c) => c.key), data: rows.map((r) => COLUMNS.map((c) => r[c.key] ?? "")) });
}

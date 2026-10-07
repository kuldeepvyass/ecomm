"use client";

import { unzipSync } from "fflate";
import { CheckCircle2, FileSpreadsheet, FileArchive, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

type Kind = "IMPORT" | "BULK_UPDATE" | "BULK_DELETE";
type PreviewRow = { row: number; sku: string; action: string; reason?: string; errors?: string[]; warnings?: string[]; images?: string[]; name?: string; mrp?: number };
type Preview = { jobId: string; summary: Record<string, number>; rows: PreviewRow[] };
type Result = { summary: { created: number; updated: number; skipped: number; failed: number }; failures?: { row: number; sku: string; reason?: string }[] };

const MODES: { kind: Kind; title: string; body: string }[] = [
  { kind: "IMPORT", title: "Import", body: "Create new SKUs and update existing ones from the template." },
  { kind: "BULK_UPDATE", title: "Bulk update", body: "Match on SKU and change only the columns you include — e.g. just sku + mrp + stock." },
  { kind: "BULK_DELETE", title: "Remove / deactivate", body: "Move SKUs to trash (restorable) or hide them as drafts." },
];
const IMG_EXT = /\.(jpe?g|png|webp|avif)$/i;
const CHUNK = 10;

export function Importer() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("IMPORT");
  const [file, setFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<Map<string, Uint8Array>>(new Map());
  const [zipName, setZipName] = useState("");
  const [skuList, setSkuList] = useState("");
  const [deleteMode, setDeleteMode] = useState<"delete" | "deactivate">("delete");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");
  const [defaultStock, setDefaultStock] = useState("1");
  const [publish, setPublish] = useState(true);
  const [ratingSource, setRatingSource] = useState("");
  const [checkImages, setCheckImages] = useState(true);

  function reset() { setPreview(null); setResult(null); setProgress(0); }

  async function readZip(f: File) {
    setBusy("Reading ZIP…");
    try {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (e) => IMG_EXT.test(e.name) && !e.name.startsWith("__MACOSX") });
      const map = new Map<string, Uint8Array>();
      for (const [path, data] of Object.entries(entries)) map.set(path.split("/").pop()!, data);
      setZipFiles(map);
      setZipName(f.name);
      toast.success(`${map.size} images found in ${f.name}`);
      reset();
    } catch {
      toast.error("Couldn't read that ZIP file.");
    } finally {
      setBusy(null);
    }
  }

  async function runPreview() {
    setBusy("Validating…");
    reset();
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("deleteMode", deleteMode);
      fd.set("zipNames", JSON.stringify([...zipFiles.keys()]));
      fd.set("defaultStock", defaultStock);
      fd.set("publish", String(publish));
      fd.set("ratingSource", ratingSource);
      fd.set("checkImages", String(checkImages));
      if (file) fd.set("file", file);
      if (kind === "BULK_DELETE") fd.set("skuList", skuList);
      const res = await fetch("/api/admin/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
    } catch (e) {
      toast.error((e as Error).message || "Validation failed");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!preview) return;
    const actionable = preview.rows.filter((r) => ["create", "update", "delete", "deactivate"].includes(r.action)).length;
    if (kind === "BULK_DELETE" && !confirm(`${deleteMode === "delete" ? "Move" : "Deactivate"} ${actionable} products?`)) return;
    try {
      // 1. Upload only the ZIP images that rows actually reference.
      const needed = [...new Set(preview.rows.filter((r) => r.action === "create" || r.action === "update").flatMap((r) => r.images ?? []).filter((n) => !/^https?:/i.test(n)))];
      const imageMap: Record<string, unknown> = {};
      let done = 0;
      const queue = [...needed];
      const worker = async () => {
        while (queue.length) {
          const name = queue.shift()!;
          const data = [...zipFiles.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
          if (!data) continue;
          const fd = new FormData();
          fd.set("file", new File([data as BlobPart], name));
          fd.set("purpose", "products");
          const res = await fetch("/api/uploads", { method: "POST", body: fd });
          const json = await res.json();
          if (res.ok) imageMap[name] = json; else toast.error(`${name}: ${json.error}`);
          done++;
          setBusy(`Uploading images ${done}/${needed.length}…`);
          setProgress(Math.round((done / Math.max(1, needed.length)) * 40));
        }
      };
      if (needed.length) await Promise.all(Array.from({ length: 4 }, worker));

      // 2. Commit in chunks.
      let last: Result | null = null;
      for (let from = 0; from < preview.rows.length; from += CHUNK) {
        setBusy(`Saving rows ${from + 1}–${Math.min(from + CHUNK, preview.rows.length)} of ${preview.rows.length}…`);
        const res = await fetch("/api/admin/import/commit", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: preview.jobId, from, to: from + CHUNK, imageMap }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        last = data;
        setProgress(40 + Math.round((data.processed / data.total) * 60));
      }
      setResult(last);
      toast.success("Import complete");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Import failed");
    } finally {
      setBusy(null);
    }
  }

  const shown = preview ? (filter === "error" ? preview.rows.filter((r) => r.action === "error") : filter === "warning" ? preview.rows.filter((r) => r.warnings?.length) : preview.rows) : [];

  return (
    <section className="border border-border bg-surface p-5 md:p-8" data-testid="importer">
      <div className="grid gap-3 md:grid-cols-3">
        {MODES.map((m) => (
          <button key={m.kind} type="button" onClick={() => { setKind(m.kind); reset(); }} aria-pressed={kind === m.kind}
            className={cn("border p-4 text-left transition-colors", kind === m.kind ? "border-gold bg-gold-soft" : "border-border hover:border-border-strong")}>
            <p className="font-medium">{m.title}</p>
            <p className="mt-1 text-xs text-fg-muted">{m.body}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border-strong p-6 text-center text-sm hover:border-gold">
          <FileSpreadsheet className="size-6 text-gold" aria-hidden />
          <span>{file ? file.name : "Choose spreadsheet (.xlsx or .csv)"}</span>
          <input type="file" accept=".xlsx,.csv" className="sr-only" data-testid="import-file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }} />
        </label>
        {kind === "BULK_DELETE" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="skus" className="text-sm text-fg-muted">…or paste SKUs (one per line / comma-separated)</label>
            <textarea id="skus" value={skuList} onChange={(e) => { setSkuList(e.target.value); reset(); }} rows={4} className="rounded-[2px] border border-border bg-bg p-3 font-mono text-sm" />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={deleteMode === "delete"} onChange={() => setDeleteMode("delete")} className="accent-[var(--gold)]" /> Move to trash</label>
              <label className="flex items-center gap-2"><input type="radio" checked={deleteMode === "deactivate"} onChange={() => setDeleteMode("deactivate")} className="accent-[var(--gold)]" /> Deactivate (draft)</label>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border-strong p-6 text-center text-sm hover:border-gold">
            <FileArchive className="size-6 text-gold" aria-hidden />
            <span>{zipName ? `${zipName} · ${zipFiles.size} images` : "Optional: ZIP of images (names used in the images column)"}</span>
            <input type="file" accept=".zip" className="sr-only" onChange={(e) => e.target.files?.[0] && void readZip(e.target.files[0])} />
          </label>
        )}
      </div>

      {kind === "IMPORT" && (
        <fieldset className="mt-6 grid gap-4 border border-border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <legend className="px-1 text-xs uppercase tracking-[0.12em] text-fg-muted">For new products</legend>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted">Stock when the file has none</span>
            <input type="number" min={0} max={9999} inputMode="numeric" value={defaultStock} onChange={(e) => { setDefaultStock(e.target.value); reset(); }} className="min-h-11 rounded-[2px] border border-border bg-bg px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted">Rating source label</span>
            <input value={ratingSource} onChange={(e) => { setRatingSource(e.target.value); reset(); }} placeholder="e.g. Amazon.in (optional)" maxLength={60} className="min-h-11 rounded-[2px] border border-border bg-bg px-3" />
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end">
            <input type="checkbox" checked={publish} onChange={(e) => { setPublish(e.target.checked); reset(); }} className="size-4 accent-[var(--gold)]" />
            Publish immediately <span className="text-xs text-fg-subtle">(no-image rows stay drafts)</span>
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end">
            <input type="checkbox" checked={checkImages} onChange={(e) => { setCheckImages(e.target.checked); reset(); }} className="size-4 accent-[var(--gold)]" />
            Check image links load
          </label>
        </fieldset>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={runPreview} disabled={!!busy || (!file && !(kind === "BULK_DELETE" && skuList.trim()))} loading={busy === "Validating…"} data-testid="import-preview">Validate & preview</Button>
        {busy && <p className="text-sm text-fg-muted" aria-live="polite">{busy}</p>}
      </div>
      {progress > 0 && !result && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {preview && !result && (
        <div className="mt-8" data-testid="import-preview-result">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="success">{preview.summary.create} new</Badge>
            <Badge tone="gold">{preview.summary.update} updates</Badge>
            {preview.summary.delete > 0 && <Badge tone="danger">{preview.summary.delete} to remove</Badge>}
            <Badge tone="outline">{preview.summary.skip} skipped</Badge>
            <Badge tone={preview.summary.error ? "danger" : "outline"}>{preview.summary.error} with errors</Badge>
            {preview.summary.warning > 0 && <Badge tone="gold">{preview.summary.warning} with warnings</Badge>}
          </div>
          {preview.summary.error > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-warning"><AlertTriangle className="size-4" aria-hidden /> Rows with errors will be skipped. Fix them in the file and re-upload, or continue with the valid rows.</p>
          )}
          <div className="mt-4 flex gap-2 text-xs">
            <button type="button" onClick={() => setFilter("all")} className={cn("min-h-9 rounded-full border px-3", filter === "all" ? "border-gold text-gold" : "border-border")}>All rows</button>
            <button type="button" onClick={() => setFilter("error")} className={cn("min-h-9 rounded-full border px-3", filter === "error" ? "border-gold text-gold" : "border-border")}>Errors only</button>
            <button type="button" onClick={() => setFilter("warning")} className={cn("min-h-9 rounded-full border px-3", filter === "warning" ? "border-gold text-gold" : "border-border")}>Warnings</button>
          </div>
          <div className="mt-3 max-h-[28rem] overflow-auto border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase tracking-[0.12em] text-fg-muted">
                <tr><th className="p-2">Row</th><th className="p-2">SKU</th><th className="p-2">Action</th><th className="p-2">Product</th><th className="p-2">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.slice(0, 500).map((r) => (
                  <tr key={r.row} className={r.action === "error" ? "bg-danger/5" : undefined}>
                    <td className="p-2 tabular-nums">{r.row}</td>
                    <td className="p-2 font-mono text-xs">{r.sku || "—"}</td>
                    <td className="p-2"><Badge tone={r.action === "error" ? "danger" : r.action === "create" ? "success" : r.action === "skip" ? "outline" : "gold"}>{r.action}</Badge></td>
                    <td className="p-2">{r.name ?? ""}{r.mrp ? <span className="text-fg-muted"> · {formatINR(r.mrp)}</span> : null}</td>
                    <td className="p-2 text-xs text-fg-muted">
                      {r.errors?.join(" · ") ?? r.reason ?? (r.images?.length ? `${r.images.length} image link${r.images.length > 1 ? "s" : ""}` : "")}
                      {r.warnings?.length ? <span className="mt-1 block text-warning">{r.warnings.join(" · ")}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={commit} loading={!!busy && busy !== "Validating…"} disabled={preview.summary.create + preview.summary.update + preview.summary.delete === 0} data-testid="import-commit">
              Confirm {kind === "BULK_DELETE" ? "removal" : "import"}
            </Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8 border border-success/40 bg-success/10 p-5" data-testid="import-summary">
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-5 text-success" aria-hidden /> Import finished</p>
          <p className="mt-2 text-sm">Created <strong>{result.summary.created}</strong> · Updated <strong>{result.summary.updated}</strong> · Skipped <strong>{result.summary.skipped}</strong> · Failed <strong>{result.summary.failed}</strong></p>
          {result.failures && result.failures.length > 0 && (
            <ul className="mt-3 max-h-48 overflow-auto text-xs text-danger">
              {result.failures.map((f) => <li key={f.row}>Row {f.row} ({f.sku || "no SKU"}): {f.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

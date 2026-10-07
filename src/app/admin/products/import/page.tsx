import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Importer } from "./importer";

export const metadata: Metadata = { title: "Import / export" };

export default async function ImportPage() {
  await requireAdmin();
  const history = await db.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { actor: { select: { email: true } } } });
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Import / export" description="Bulk-create, update or remove products from a spreadsheet. Nothing changes until you confirm the preview."
        actions={<>
          <Button asChild variant="outline" size="sm"><a href="/api/admin/import/template"><Download aria-hidden /> Template (.xlsx)</a></Button>
          <Button asChild variant="outline" size="sm"><a href="/api/admin/import/template?format=csv"><Download aria-hidden /> Template (.csv)</a></Button>
          <Button asChild size="sm"><a href="/api/admin/export"><Download aria-hidden /> Export catalog</a></Button>
        </>} />
      <Importer />
      <section>
        <h2 className="mb-3 text-2xl">History</h2>
        <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-sm" data-testid="import-history">
            <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted">
              <tr><th className="p-3">When</th><th className="p-3">Type</th><th className="p-3">File</th><th className="p-3">Status</th><th className="p-3 text-right">Created</th><th className="p-3 text-right">Updated</th><th className="p-3 text-right">Skipped</th><th className="p-3 text-right">Failed</th><th className="p-3">By</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((j) => (
                <tr key={j.id}>
                  <td className="p-3 whitespace-nowrap">{j.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                  <td className="p-3">{j.kind.replace("_", " ").toLowerCase()}</td>
                  <td className="max-w-48 truncate p-3">{j.fileName}</td>
                  <td className="p-3"><Badge tone={j.status === "COMPLETED" ? "success" : j.status === "FAILED" ? "danger" : "outline"}>{j.status.toLowerCase()}</Badge></td>
                  <td className="p-3 text-right">{j.createdCount}</td><td className="p-3 text-right">{j.updatedCount}</td>
                  <td className="p-3 text-right">{j.skippedCount}</td><td className="p-3 text-right">{j.failedCount}</td>
                  <td className="p-3 text-fg-muted">{j.actor.email}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-fg-muted">No imports yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

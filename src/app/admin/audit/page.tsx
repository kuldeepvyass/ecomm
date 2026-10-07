import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const rows = await db.auditLog.findMany({
    where: q ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { entityType: { contains: q, mode: "insensitive" } }, { entityId: q }, { actor: { email: { contains: q, mode: "insensitive" } } }] } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { email: true } } },
  });
  const items = rows.slice(0, 50);
  return (
    <div>
      <PageHeader title="Audit log" description="Every admin action, who did it, when, and what changed." />
      <form className="mb-4" action="/admin/audit"><input name="q" defaultValue={q} placeholder="Filter by action, entity, ID or admin email" aria-label="Filter audit log" className="h-10 w-full max-w-md rounded-[2px] border border-border bg-surface px-3 text-sm" /></form>
      <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
        <table className="w-full min-w-[760px] text-sm" data-testid="audit-table">
          <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted"><tr><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Changes</th></tr></thead>
          <tbody className="divide-y divide-border align-top">
            {items.map((a) => (
              <tr key={a.id}>
                <td className="p-3 whitespace-nowrap">{a.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" })}</td>
                <td className="p-3">{a.actor?.email ?? "system"}<span className="block text-xs text-fg-subtle">{a.ip}</span></td>
                <td className="p-3 font-mono text-xs">{a.action}</td>
                <td className="p-3 text-xs">{a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 12)}` : ""}</td>
                <td className="max-w-md p-3"><code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all text-xs text-fg-muted">{a.diff ? JSON.stringify(a.diff) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 50 && <Link className="mt-4 inline-block text-sm text-gold" href={`/admin/audit?${new URLSearchParams({ ...(q ? { q } : {}), cursor: items[items.length - 1].id })}`}>Older →</Link>}
    </div>
  );
}

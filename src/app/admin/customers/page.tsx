import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { REVENUE_STATUSES } from "@/server/admin/dashboard";

export const metadata: Metadata = { title: "Customers" };

export default async function Customers({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const rows = await db.user.findMany({
    where: { deletedAt: null, ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, email: true, name: true, phone: true, role: true, blockedAt: true, createdAt: true, _count: { select: { orders: true } } },
  });
  const users = rows.slice(0, 30);
  const spend = await db.order.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) }, status: { in: [...REVENUE_STATUSES] } }, _sum: { grandTotal: true } });
  const spendMap = new Map(spend.map((s) => [s.userId, s._sum.grandTotal ?? 0]));
  return (
    <div>
      <PageHeader title="Customers" />
      <form className="mb-4" action="/admin/customers"><input name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search customers" className="h-10 w-full max-w-md rounded-[2px] border border-border bg-surface px-3 text-sm" /></form>
      <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted"><tr><th className="p-3">Customer</th><th className="p-3">Joined</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Lifetime spend</th><th className="p-3">Status</th></tr></thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="p-3"><Link href={`/admin/customers/${u.id}`} className="font-medium hover:text-gold">{u.name ?? "—"}</Link><span className="block text-xs text-fg-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span></td>
                <td className="p-3">{u.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td className="p-3 text-right">{u._count.orders}</td>
                <td className="p-3 text-right">{formatINR(spendMap.get(u.id) ?? 0)}</td>
                <td className="p-3 flex gap-1">{u.role === "ADMIN" && <Badge tone="gold">Admin</Badge>}{u.blockedAt ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Active</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 30 && <Link href={`/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), cursor: users[users.length - 1].id })}`} className="mt-4 inline-block text-sm text-gold">Next page →</Link>}
    </div>
  );
}

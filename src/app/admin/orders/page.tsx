import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/account/status-badge";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders/transitions";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
const PAGE = 30;

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? (sp.status as keyof typeof STATUS_LABEL) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const from = typeof sp.from === "string" && sp.from ? new Date(`${sp.from}T00:00:00+05:30`) : undefined;
  const to = typeof sp.to === "string" && sp.to ? new Date(`${sp.to}T23:59:59+05:30`) : undefined;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(q ? { OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { shipName: { contains: q, mode: "insensitive" } }, { shipPhone: { contains: q } }, { user: { email: { contains: q, mode: "insensitive" } } }, { trackingNumber: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { email: true } }, _count: { select: { items: true } } } }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const orders = rows.slice(0, PAGE);
  const next = rows.length > PAGE ? orders[orders.length - 1].id : null;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, q, from: typeof sp.from === "string" ? sp.from : undefined, to: typeof sp.to === "string" ? sp.to : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/orders?${p}`;
  };

  return (
    <div>
      <PageHeader title="Orders" />
      <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 no-scrollbar">
        <Link href={qs({ status: undefined, cursor: undefined })} className={cn("min-h-10 whitespace-nowrap rounded-full border px-4 text-xs uppercase leading-10 tracking-[0.12em]", !status ? "border-gold text-gold" : "border-border text-fg-muted")}>All</Link>
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => {
          const n = counts.find((c) => c.status === s)?._count ?? 0;
          return (
            <Link key={s} href={qs({ status: s, cursor: undefined })} className={cn("min-h-10 whitespace-nowrap rounded-full border px-4 text-xs uppercase leading-10 tracking-[0.12em]", status === s ? "border-gold text-gold" : "border-border text-fg-muted")}>
              {STATUS_LABEL[s]} ({n})
            </Link>
          );
        })}
      </div>
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Order no., name, phone, email, AWB" aria-label="Search orders" className="h-10 min-w-64 flex-1 rounded-[2px] border border-border bg-surface px-3 text-sm" />
        <label className="flex items-center gap-2 text-xs text-fg-muted">From <input type="date" name="from" defaultValue={typeof sp.from === "string" ? sp.from : ""} className="h-10 rounded-[2px] border border-border bg-surface px-2 text-sm text-fg" /></label>
        <label className="flex items-center gap-2 text-xs text-fg-muted">To <input type="date" name="to" defaultValue={typeof sp.to === "string" ? sp.to : ""} className="h-10 rounded-[2px] border border-border bg-surface px-2 text-sm text-fg" /></label>
        <button type="submit" className="h-10 rounded-[2px] border border-border px-4 text-xs uppercase tracking-[0.12em] hover:border-gold">Filter</button>
      </form>
      <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto border border-border">
        <table className="w-full min-w-[760px] text-sm" data-testid="admin-orders-table">
          <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-fg-muted">
            <tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-surface">
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-gold">{o.orderNumber}</Link></td>
                <td className="p-3 whitespace-nowrap">{o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                <td className="p-3">{o.shipName}<span className="block text-xs text-fg-muted">{o.user.email}</span></td>
                <td className="p-3">{o._count.items}</td>
                <td className="p-3 text-right">{formatINR(o.grandTotal)}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-fg-muted">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
      {next && <div className="mt-4"><Link href={qs({ cursor: next })} className="text-sm text-gold">Next page →</Link></div>}
    </div>
  );
}

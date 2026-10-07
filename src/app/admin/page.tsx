import type { Metadata } from "next";
import { AlertTriangle, ClipboardList, IndianRupee, RotateCcw, Star } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { SalesChart } from "@/components/admin/sales-chart";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { dashboardData } from "@/server/admin/dashboard";
import { expireUnpaidOrders } from "@/server/orders/service";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border bg-surface p-4 md:p-5">
      <p className="eyebrow text-fg-muted">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums md:text-4xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-fg-muted">{sub}</p>}
    </div>
  );
}

export default async function Dashboard() {
  await requireAdmin();
  await expireUnpaidOrders();
  const d = await dashboardData();
  const tasks = [
    { href: "/admin/payments", label: "UPI payments to verify", n: d.toVerify, icon: IndianRupee },
    { href: "/admin/orders?status=PAID", label: "Orders to process", n: d.toShip, icon: ClipboardList },
    { href: "/admin/reviews", label: "Reviews to moderate", n: d.pendingReviews, icon: Star },
    { href: "/admin/orders?status=RETURN_REQUESTED", label: "Return requests", n: d.pendingReturns, icon: RotateCcw },
  ];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Dashboard" description="Revenue counts orders with a confirmed UPI payment, excluding cancellations and refunds. Times in IST." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Today" value={formatINR(d.today.revenue)} sub={plural(d.today.orders, "order")} />
        <Tile label="Last 7 days" value={formatINR(d.week.revenue)} sub={`${plural(d.week.orders, "order")} · AOV ${formatINR(d.week.aov)}`} />
        <Tile label="Last 30 days" value={formatINR(d.month.revenue)} sub={plural(d.month.orders, "order")} />
        <Tile label="Avg. order value (30d)" value={formatINR(d.month.aov)} />
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tasks.map(({ href, label, n, icon: Icon }) => (
          <li key={href}><Link href={href} className="flex items-center gap-3 border border-border p-4 hover:border-gold"><Icon className="size-5 text-gold" aria-hidden /><span className="flex-1 text-sm">{label}</span><span className="font-display text-2xl">{n}</span></Link></li>
        ))}
      </ul>
      <SalesChart data={d.series} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-border p-4 md:p-6">
          <h2 className="mb-4 text-xl">Top products (30 days)</h2>
          {d.top.length === 0 ? <p className="text-sm text-fg-muted">No sales yet.</p> : (
            <ol className="flex flex-col gap-3">
              {d.top.map((t, i) => {
                const pct = Math.round((t.revenue / d.top[0].revenue) * 100);
                return (
                  <li key={t.productId}>
                    <div className="flex justify-between gap-3 text-sm"><Link href={`/admin/products/${t.productId}`} className="truncate hover:text-gold">{i + 1}. {t.name}</Link><span className="shrink-0 tabular-nums">{formatINR(t.revenue)} · {t.quantity} sold</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--chart-1)" }} /></div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className="border border-border p-4 md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl"><AlertTriangle className="size-5 text-warning" aria-hidden /> Low stock</h2>
          {d.lowStock.length === 0 ? <p className="text-sm text-fg-muted">All live products have healthy stock.</p> : (
            <ul className="divide-y divide-border text-sm" data-testid="low-stock">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2"><Link href={`/admin/products/${p.id}`} className="truncate hover:text-gold">{p.brand.name} {p.modelName} <span className="text-fg-muted">· {p.sku}</span></Link><span className={p.stock === 0 ? "shrink-0 whitespace-nowrap text-danger" : "shrink-0 whitespace-nowrap text-warning"}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

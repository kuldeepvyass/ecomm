import type { Metadata } from "next";
import { Package } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/account/status-badge";
import { WatchImage } from "@/components/product/watch-image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  const user = await requireUser("/account/orders");
  const sp = await searchParams;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const rows = await db.order.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 11,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { items: { take: 3, select: { imageUrl: true, modelName: true } }, _count: { select: { items: true } } },
  });
  const orders = rows.slice(0, 10);
  const next = rows.length > 10 ? orders[orders.length - 1].id : null;

  if (orders.length === 0 && !cursor) {
    return <EmptyState icon={<Package />} title="No orders yet" description="When you place an order, you'll be able to track it here."
      action={<Button asChild><Link href="/watches">Start shopping</Link></Button>} />;
  }
  return (
    <div>
      <h2 className="mb-6 text-3xl">Orders</h2>
      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/account/orders/${o.id}`} className="flex flex-col gap-4 border border-border p-4 transition-colors hover:border-gold sm:flex-row sm:items-center" data-testid="order-row">
              <div className="flex -space-x-3">
                {o.items.map((it, i) => (
                  <span key={i} className="relative size-14 overflow-hidden rounded-full border-2 border-bg bg-surface-2">
                    {it.imageUrl && <WatchImage src={it.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-fg-muted">
                  {o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} · {o._count.items} {o._count.items === 1 ? "item" : "items"} · {formatINR(o.grandTotal)}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          </li>
        ))}
      </ul>
      {next && <div className="mt-6"><Button asChild variant="outline"><Link href={`/account/orders?cursor=${next}`}>Older orders</Link></Button></div>}
    </div>
  );
}

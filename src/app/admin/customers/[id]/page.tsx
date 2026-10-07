import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/account/status-badge";
import { db } from "@/lib/db";
import { stateName } from "@/lib/india";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { setCustomerBlocked } from "@/server/actions/admin/store";

export const metadata: Metadata = { title: "Customer" };

export default async function Customer({ params }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 50 }, addresses: true, _count: { select: { reviews: true, wishlist: true } } },
  });
  if (!u) notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={u.name ?? u.email} description={`${u.email}${u.phone ? ` · ${u.phone}` : ""} · joined ${u.createdAt.toLocaleDateString("en-IN")} · ${u._count.reviews} reviews · ${u._count.wishlist} wishlisted`}
        actions={u.role !== "ADMIN" && (u.blockedAt
          ? <ActionButton variant="outline" size="sm" action={setCustomerBlocked.bind(null, u.id, false)}>Unblock</ActionButton>
          : <ActionButton variant="danger" size="sm" confirmText="Block this customer? They will be signed out and unable to sign in." action={setCustomerBlocked.bind(null, u.id, true)}>Block</ActionButton>)} />
      <section>
        <h2 className="mb-3 text-2xl">Orders</h2>
        <ul className="divide-y divide-border border-y border-border text-sm">
          {u.orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-gold">{o.orderNumber}</Link>
              <span className="text-fg-muted">{o.createdAt.toLocaleDateString("en-IN")}</span>
              <span>{formatINR(o.grandTotal)}</span>
              <StatusBadge status={o.status} />
            </li>
          ))}
          {u.orders.length === 0 && <li className="py-3 text-fg-muted">No orders.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-2xl">Addresses</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {u.addresses.map((a) => <li key={a.id} className="border border-border p-3 text-sm">{a.fullName}<br />{a.line1}, {a.city}, {stateName(a.state)} {a.pincode}<br />+91 {a.phone}</li>)}
        </ul>
      </section>
    </div>
  );
}

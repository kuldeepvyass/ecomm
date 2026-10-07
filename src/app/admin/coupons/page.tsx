import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { CouponsView } from "./coupons-view";

export const metadata: Metadata = { title: "Coupons" };

export default async function Coupons() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="Coupons" description="Percentage or flat discounts on the bag subtotal (after product discounts)." />
      <CouponsView coupons={coupons.map((c) => ({ ...c, value: Number(c.value), startsAt: c.startsAt?.toISOString() ?? null, expiresAt: c.expiresAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))} />
    </div>
  );
}

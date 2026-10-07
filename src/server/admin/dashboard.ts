import "server-only";
import { db } from "@/lib/db";

/** Orders that represent real revenue (payment confirmed, not cancelled/refunded). */
export const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED"] as const;

function istStartOfDay(daysAgo: number) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600_000 - daysAgo * 86_400_000);
}

export async function dashboardData() {
  const since30 = istStartOfDay(29);
  const [orders, lowStock, pendingReviews, pendingReturns, toShip, topItems, toVerify] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: since30 }, status: { in: [...REVENUE_STATUSES] } }, select: { createdAt: true, grandTotal: true } }),
    db.product.findMany({ where: { deletedAt: null, status: "ACTIVE", stock: { lte: 2 } }, orderBy: { stock: "asc" }, take: 10, select: { id: true, modelName: true, stock: true, sku: true, brand: { select: { name: true } } } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.returnRequest.count({ where: { status: "REQUESTED" } }),
    db.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    db.orderItem.groupBy({
      by: ["productId", "brandName", "modelName"],
      where: { order: { createdAt: { gte: since30 }, status: { in: [...REVENUE_STATUSES] } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
    db.payment.count({ where: { status: "SUBMITTED" } }),
  ]);

  const windowStats = (days: number) => {
    const from = istStartOfDay(days - 1);
    const list = orders.filter((o) => o.createdAt >= from);
    const revenue = list.reduce((s, o) => s + o.grandTotal, 0);
    return { revenue, orders: list.length, aov: list.length ? Math.round(revenue / list.length) : 0 };
  };

  const days = Array.from({ length: 30 }, (_, i) => {
    const start = istStartOfDay(29 - i);
    const end = new Date(start.getTime() + 86_400_000);
    const list = orders.filter((o) => o.createdAt >= start && o.createdAt < end);
    const label = new Date(start.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
    return { date: label, revenue: list.reduce((s, o) => s + o.grandTotal, 0), orders: list.length };
  });

  return {
    today: windowStats(1),
    week: windowStats(7),
    month: windowStats(30),
    series: days,
    lowStock,
    pendingReviews,
    pendingReturns,
    toShip,
    toVerify,
    top: topItems.map((t) => ({ productId: t.productId, name: `${t.brandName} ${t.modelName}`, quantity: t._sum.quantity ?? 0, revenue: t._sum.lineTotal ?? 0 })),
  };
}

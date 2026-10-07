import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { estimateDelivery } from "@/server/delivery";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const user = await requireUser("/account/orders");
  const sp = await searchParams;
  const orderId = typeof sp.order === "string" ? sp.order : "";
  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id } });
  if (!order) notFound();
  if (["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAYMENT_FAILED"].includes(order.status)) redirect(`/checkout/pay/${order.id}`);
  const est = await estimateDelivery(order.shipPincode);

  return (
    <div className="container-luxe flex justify-center py-16 md:py-24">
      <div className="max-w-lg text-center">
        <CheckCircle2 className="mx-auto mb-6 size-12 text-gold" strokeWidth={1.25} aria-hidden />
        <>
            <p className="eyebrow text-gold" data-testid="success-order-number">Order {order.orderNumber}</p>
            <h1 className="mt-3 text-4xl md:text-5xl">Thank you</h1>
            <p className="mt-4 text-fg-muted">
              Your UPI payment has been verified and your order is confirmed.{" "}
              A confirmation has been sent to your email.
            </p>
            <p className="mt-6 text-lg">Total paid: <strong className="font-medium">{formatINR(order.grandTotal)}</strong></p>
            {est.ok && <p className="mt-2 text-fg-muted">Expected delivery: {est.from} – {est.to}</p>}
        </>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild><Link href={`/account/orders/${order.id}`}>View order</Link></Button>
          <Button asChild variant="outline"><Link href="/watches">Continue shopping</Link></Button>
        </div>
      </div>
    </div>
  );
}

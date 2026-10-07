import type { Metadata } from "next";
import { Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { awaitingPayment } from "@/lib/orders/transitions";
import { upiAppLinks } from "@/lib/upi";
import { requireUser } from "@/lib/session";
import { expireUnpaidOrders } from "@/server/orders/service";
import { effectiveUpi, upiQrSvg } from "@/server/payments/upi";
import { readSettings } from "@/server/settings";
import { PaymentPending, UpiPay } from "./upi-pay";

export const metadata: Metadata = { title: "Pay by UPI", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: PageProps<"/checkout/pay/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/checkout/pay/${id}`);
  let order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: { payments: { orderBy: { createdAt: "desc" } }, items: { select: { brandName: true, modelName: true, quantity: true } } },
  });
  if (!order) notFound();

  // Release the reservation if the payment window already passed.
  if (awaitingPayment(order.status) && order.paymentDueAt && order.paymentDueAt < new Date()) {
    await expireUnpaidOrders();
    order = (await db.order.findFirst({ where: { id }, include: { payments: { orderBy: { createdAt: "desc" } }, items: { select: { brandName: true, modelName: true, quantity: true } } } }))!;
  }

  const summary = order.items.map((i) => `${i.brandName} ${i.modelName}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ");

  if (order.status === "CANCELLED") {
    return (
      <Shell orderNumber={order.orderNumber}>
        <Clock className="mx-auto size-10 text-gold" aria-hidden />
        <h1 className="mt-4 text-center text-3xl">This payment window has closed</h1>
        <p className="mt-3 text-center text-fg-muted">We held your watch for you, but no payment was submitted in time, so order {order.orderNumber} was released. If you&apos;ve already paid, contact us with your UTR and we&apos;ll sort it out straight away.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild><Link href="/watches">Continue shopping</Link></Button>
          <Button asChild variant="outline"><Link href="/contact">Contact us</Link></Button>
        </div>
      </Shell>
    );
  }
  if (order.status === "PAYMENT_SUBMITTED") {
    const p = order.payments[0];
    return (
      <Shell orderNumber={order.orderNumber}>
        <PaymentPending orderId={order.id} orderNumber={order.orderNumber} amount={order.grandTotal} utr={p?.utr ?? ""} submittedAt={p?.createdAt.toISOString() ?? new Date().toISOString()} />
      </Shell>
    );
  }
  if (!awaitingPayment(order.status)) redirect(`/checkout/success?order=${order.id}`);

  const settings = await readSettings();
  const upi = effectiveUpi(settings);
  if (!upi) {
    return (
      <Shell orderNumber={order.orderNumber}>
        <h1 className="text-center text-3xl">UPI is temporarily unavailable</h1>
        <p className="mt-3 text-center text-fg-muted">Please contact us to complete order {order.orderNumber}: {settings.contactEmail} · {settings.contactPhone}</p>
      </Shell>
    );
  }
  const req = { vpa: upi.vpa, payeeName: upi.payeeName, amount: order.grandTotal, orderNumber: order.orderNumber };
  const rejected = order.status === "PAYMENT_FAILED" ? order.payments.find((p) => p.status === "REJECTED") : undefined;

  return (
    <Shell orderNumber={order.orderNumber}>
      <UpiPay
        orderId={order.id}
        orderNumber={order.orderNumber}
        amount={order.grandTotal}
        amountLabel={formatINR(order.grandTotal)}
        summary={summary}
        vpa={upi.vpa}
        payeeName={upi.payeeName}
        placeholder={upi.placeholder}
        qrSvg={await upiQrSvg(req)}
        appLinks={[...upiAppLinks(req)]}
        dueAt={order.paymentDueAt?.toISOString() ?? null}
        rejection={rejected ? { utr: rejected.utr, reason: rejected.rejectReason ?? "" } : null}
      />
    </Shell>
  );
}

function Shell({ orderNumber, children }: { orderNumber: string; children: React.ReactNode }) {
  return (
    <div className="container-luxe flex justify-center py-8 pb-24 md:py-14">
      <div className="w-full max-w-xl">
        <div className="mb-4 flex items-center justify-between text-xs text-fg-muted">
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-gold" aria-hidden /> Secure UPI payment · no fees</span>
          <span>Order {orderNumber}</span>
        </div>
        <div className="border border-border bg-surface p-5 shadow-luxe md:p-8">{children}</div>
      </div>
    </div>
  );
}

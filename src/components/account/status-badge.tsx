import type { OrderStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "@/lib/orders/transitions";
import { cn } from "@/lib/utils";

const TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-warning/50 text-warning",
  PAYMENT_SUBMITTED: "border-warning/50 text-warning",
  PAYMENT_FAILED: "border-danger/50 text-danger",
  PAID: "border-gold/50 text-gold",
  PROCESSING: "border-gold/50 text-gold",
  SHIPPED: "border-gold/50 text-gold",
  OUT_FOR_DELIVERY: "border-gold/50 text-gold",
  DELIVERED: "border-success/50 text-success",
  CANCELLED: "border-border-strong text-fg-muted",
  RETURN_REQUESTED: "border-warning/50 text-warning",
  RETURNED: "border-border-strong text-fg-muted",
  REFUNDED: "border-border-strong text-fg-muted",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center whitespace-nowrap rounded-full border px-3 text-[0.6875rem] font-medium uppercase tracking-[0.12em]", TONE[status], className)} data-testid="order-status">
      {STATUS_LABEL[status]}
    </span>
  );
}

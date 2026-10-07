import { Check } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { FULFILMENT_STEPS, STATUS_LABEL } from "@/lib/orders/transitions";
import { cn } from "@/lib/utils";

type Event = { id: string; toStatus: OrderStatus; createdAt: Date; note: string | null; courierName: string | null; trackingNumber: string | null; trackingUrl: string | null };

const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Happy-path stepper + full chronological event log (incl. cancellations / returns). */
export function OrderTimeline({ status, events }: { status: OrderStatus; events: Event[] }) {
  const reached = new Map<OrderStatus, Event>();
  for (const e of events) reached.set(e.toStatus, e);
  const offPath = ["CANCELLED", "PAYMENT_FAILED", "RETURN_REQUESTED", "RETURNED", "REFUNDED", "PENDING_PAYMENT"].includes(status);
  const currentIdx = FULFILMENT_STEPS.indexOf(status);

  return (
    <div className="flex flex-col gap-8">
      {!offPath || status === "RETURN_REQUESTED" || status === "RETURNED" || status === "REFUNDED" ? (
        <ol className="grid grid-cols-5 gap-1" aria-label="Order progress" data-testid="order-timeline">
          {FULFILMENT_STEPS.map((s, i) => {
            const ev = reached.get(s) ?? (s === "PAID" ? reached.get("PROCESSING") : undefined);
            const done = currentIdx >= i || Boolean(ev) || (offPath && reached.has("DELIVERED"));
            return (
              <li key={s} className="flex flex-col items-center text-center" aria-current={currentIdx === i ? "step" : undefined}>
                <div className="flex w-full items-center">
                  <span className={cn("h-px flex-1", i === 0 ? "bg-transparent" : done ? "bg-gold" : "bg-border")} />
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs", done ? "border-gold bg-gold text-on-gold" : "border-border text-fg-subtle")}>
                    {done ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("h-px flex-1", i === FULFILMENT_STEPS.length - 1 ? "bg-transparent" : currentIdx > i ? "bg-gold" : "bg-border")} />
                </div>
                <span className={cn("mt-2 text-[0.6875rem] leading-tight md:text-xs", done ? "text-fg" : "text-fg-subtle")}>{STATUS_LABEL[s]}</span>
                {ev && <span className="mt-0.5 hidden text-[0.625rem] text-fg-subtle sm:block">{fmt(ev.createdAt)}</span>}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div>
        <h3 className="eyebrow mb-3 text-fg-muted">Activity</h3>
        <ol className="relative border-l border-border pl-6">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="mb-5 last:mb-0">
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-gold" aria-hidden />
              <p className="text-sm font-medium">{STATUS_LABEL[e.toStatus]}</p>
              <p className="text-xs text-fg-subtle"><time dateTime={e.createdAt.toISOString()}>{fmt(e.createdAt)}</time></p>
              {e.note && <p className="mt-1 text-sm text-fg-muted">{e.note}</p>}
              {e.trackingNumber && (e.toStatus === "SHIPPED" || e.toStatus === "OUT_FOR_DELIVERY") && (
                <p className="mt-1 text-sm">
                  {e.courierName} · {e.trackingNumber}{" "}
                  {e.trackingUrl && <a href={e.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-4 hover:decoration-2">Track parcel</a>}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

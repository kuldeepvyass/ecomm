"use client";

import { AlertTriangle, Check, CheckCircle2, ChevronDown, Copy, ImagePlus, Loader2, QrCode, Smartphone, X } from "lucide-react";
import { Dialog } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatINR } from "@/lib/money";
import { UTR_HELP } from "@/lib/upi";
import { cn } from "@/lib/utils";
import { getPaymentState, submitPaymentUtr } from "@/server/actions/checkout";

type AppLink = { id: string; label: string; href: string };

function useCountdown(dueAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!dueAt) return;
    const tick = () => setLeft(Math.max(0, Math.floor((Date.parse(dueAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [dueAt]);
  return left;
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Pay by UPI", "Share the UTR", "We verify"];
  return (
    <ol className="mb-6 grid grid-cols-3 gap-2 text-center text-[0.6875rem] uppercase tracking-[0.12em]" aria-label="Payment steps">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="flex flex-col items-center gap-1.5">
            <span className={cn("grid size-7 place-items-center rounded-full border text-xs", done ? "border-gold bg-gold text-on-gold" : current ? "border-gold text-gold" : "border-border text-fg-subtle")}>
              {done ? <Check className="size-3.5" aria-hidden /> : n}
            </span>
            <span className={current || done ? "text-fg" : "text-fg-subtle"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function UpiPay(props: {
  orderId: string;
  orderNumber: string;
  amount: number;
  amountLabel: string;
  summary: string;
  vpa: string;
  payeeName: string;
  placeholder: boolean;
  qrSvg: string;
  appLinks: AppLink[];
  dueAt: string | null;
  rejection: { utr: string; reason: string } | null;
}) {
  const router = useRouter();
  const left = useCountdown(props.dueAt);
  // null = responsive default (app buttons on phones, QR on desktop) until the user picks a tab.
  const [view, setView] = useState<"apps" | "qr" | null>(null);
  const [utrOpen, setUtrOpen] = useState(false);
  const launched = useRef(false);

  // We can't read the result from the UPI app — when the customer comes back, ask for the UTR.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && launched.current) {
        launched.current = false;
        setUtrOpen(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);

  const mm = left === null ? "--" : String(Math.floor(left / 60)).padStart(2, "0");
  const ss = left === null ? "--" : String(left % 60).padStart(2, "0");

  return (
    <div data-testid="upi-pay">
      <Steps step={1} />
      {props.placeholder && (
        <p role="note" className="mb-5 flex gap-2 border border-warning/50 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Preview mode: the store&apos;s UPI ID isn&apos;t set yet (Admin → Settings), so this QR uses a placeholder. Do not pay it.
        </p>
      )}
      {props.rejection && (
        <p role="alert" className="mb-5 border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          We couldn&apos;t verify UTR {props.rejection.utr}{props.rejection.reason ? `: ${props.rejection.reason}` : "."} If you&apos;ve paid, re-check the 12-digit UTR in your UPI app and submit it again.
        </p>
      )}

      <div className="text-center">
        <p className="eyebrow text-fg-muted">Amount to pay</p>
        <p className="mt-1 font-display text-5xl tabular-nums" data-testid="pay-amount">{props.amountLabel}</p>
        <p className="mt-1 truncate text-xs text-fg-subtle">{props.summary}</p>
        {left !== null && (
          <p className={cn("mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", left < 300 ? "border-danger/50 text-danger" : "border-border text-fg-muted")} aria-live="off">
            Your watch is reserved for <span className="font-mono tabular-nums">{mm}:{ss}</span>
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 border border-border p-1 text-xs uppercase tracking-[0.12em]" role="tablist" aria-label="How to pay">
        <button type="button" role="tab" aria-selected={view === "apps"} onClick={() => setView("apps")} className={cn("flex min-h-11 items-center justify-center gap-2", view === "apps" ? "bg-surface-3 text-fg" : view === null ? "bg-surface-3 text-fg md:bg-transparent md:text-fg-muted" : "text-fg-muted")}>
          <Smartphone className="size-4" aria-hidden /> Pay with app
        </button>
        <button type="button" role="tab" aria-selected={view === "qr"} onClick={() => setView("qr")} className={cn("flex min-h-11 items-center justify-center gap-2", view === "qr" ? "bg-surface-3 text-fg" : view === null ? "text-fg-muted md:bg-surface-3 md:text-fg" : "text-fg-muted")}>
          <QrCode className="size-4" aria-hidden /> Scan QR
        </button>
      </div>

      {view !== "qr" && (
        <div className={cn("mt-5", view === null && "md:hidden")} role="tabpanel">
          <ul className="grid grid-cols-2 gap-3">
            {props.appLinks.map((a) => (
              <li key={a.id}>
                <a href={a.href} onClick={() => { launched.current = true; }}
                  className="flex min-h-14 items-center justify-center rounded-[2px] border border-border-strong px-3 text-sm font-medium transition-colors hover:border-gold hover:text-gold">
                  {a.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs text-fg-subtle">Opens your UPI app with the amount and order number filled in.</p>
        </div>
      )}
      {view !== "apps" && (
        <div className={cn("mt-5 flex-col items-center", view === null ? "hidden md:flex" : "flex")} role="tabpanel">
          <div className="w-56 bg-white p-3 md:w-64" aria-label={`UPI QR code for ${props.amountLabel} to ${props.payeeName}`} role="img"
            dangerouslySetInnerHTML={{ __html: props.qrSvg }} />
          <p className="mt-3 text-center text-xs text-fg-subtle">Scan with Google Pay, PhonePe, Paytm, BHIM or your bank&apos;s app</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-y border-border py-3 text-sm">
        <span className="min-w-0">
          <span className="block text-xs text-fg-muted">Paying to {props.payeeName}</span>
          <span className="block truncate font-mono" data-testid="pay-vpa">{props.vpa}</span>
        </span>
        <CopyButton value={props.vpa} label="Copy UPI ID" />
      </div>
      <p className="mt-3 text-xs text-fg-muted">
        Pay exactly <strong className="text-fg">{props.amountLabel}</strong> and keep the note “Order {props.orderNumber}”. Paying manually to the UPI ID? Use the same amount and note.
      </p>

      <Button block size="lg" className="mt-6" onClick={() => setUtrOpen(true)} data-testid="open-utr">
        I&apos;ve paid — enter UTR
      </Button>
      <p className="mt-3 text-center text-xs text-fg-subtle">No fees. Your payment goes directly to the boutique and is verified by our team.</p>

      <UtrDialog open={utrOpen} onOpenChange={setUtrOpen} orderId={props.orderId} amountLabel={props.amountLabel} onDone={() => router.refresh()} />
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error("Couldn't copy"); } }}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-xs uppercase tracking-[0.12em] text-gold" aria-label={label}>
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {done ? "Copied" : "Copy"}
    </button>
  );
}

function UtrDialog({ open, onOpenChange, orderId, amountLabel, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; orderId: string; amountLabel: string; onDone: () => void;
}) {
  const [utr, setUtr] = useState("");
  const [vpa, setVpa] = useState("");
  const [shot, setShot] = useState<{ url: string; publicId?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const digits = utr.replace(/\D/g, "");
  const pretty = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();

  async function upload(f: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("purpose", "payments");
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShot({ url: data.url, publicId: data.publicId });
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setFormError(null);
    start(async () => {
      const res = await submitPaymentUtr({ orderId, utr: digits, payerVpa: vpa, screenshot: shot });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) setFormError(res.error);
        return;
      }
      onOpenChange(false);
      toast.success("Thank you — we're verifying your payment");
      onDone();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-xl border-t border-border bg-surface p-5 pb-safe shadow-luxe data-[state=open]:animate-[sheet-up_320ms_var(--ease-luxe)] md:inset-auto md:left-1/2 md:top-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-none md:border md:data-[state=open]:animate-[fade-in_200ms_ease-out]"
          data-testid="utr-dialog">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl">Payment done?</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-fg-muted">Enter the 12-digit UTR from your UPI app so we can match your {amountLabel} payment.</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-surface-2" aria-label="Close"><X className="size-5" aria-hidden /></Dialog.Close>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4" noValidate>
            <Field label="UTR / UPI reference number" error={errors.utr} required hint={`${digits.length}/12 digits`}>
              {(p) => (
                <Input {...p} value={pretty} onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" autoComplete="off"
                  placeholder="1234 5678 9012" className="h-14 text-center font-mono text-xl tracking-[0.15em]" data-testid="utr-input" autoFocus />
              )}
            </Field>
            <details className="group border border-border px-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm">Where do I find the UTR? <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></summary>
              <ul className="pb-3 text-xs text-fg-muted">
                {UTR_HELP.map((h) => <li key={h.app} className="py-1"><strong className="text-fg">{h.app}:</strong> {h.where}</li>)}
              </ul>
            </details>
            <Field label="Your UPI ID (optional)" error={errors.payerVpa} hint="Helps us find your payment faster">
              {(p) => <Input {...p} value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@okaxis" autoComplete="off" autoCapitalize="none" />}
            </Field>
            <div>
              <p className="eyebrow mb-2 text-fg-muted">Payment screenshot (optional)</p>
              {shot ? (
                <p className="flex items-center justify-between gap-2 border border-border p-2 text-sm"><span className="flex items-center gap-2 text-success"><CheckCircle2 className="size-4" aria-hidden /> Screenshot attached</span>
                  <button type="button" className="min-h-9 px-2 text-xs text-fg-muted underline" onClick={() => setShot(null)}>Remove</button></p>
              ) : (
                <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-dashed border-border-strong text-sm text-fg-muted hover:border-gold hover:text-gold">
                  {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} {uploading ? "Uploading…" : "Attach screenshot"}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
                </label>
              )}
            </div>
            {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
            <Button type="submit" block size="lg" loading={pending} disabled={digits.length !== 12 || uploading} data-testid="submit-utr">Submit for verification</Button>
            <p className="text-center text-xs text-fg-subtle">We verify every payment by hand against our bank statement — usually within a few hours.</p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shown after the UTR is submitted; polls until the store confirms. */
export function PaymentPending({ orderId, orderNumber, amount, utr, submittedAt }: { orderId: string; orderNumber: string; amount: number; utr: string; submittedAt: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("PAYMENT_SUBMITTED");
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await getPaymentState(orderId);
      if (r.ok && r.data.status !== "PAYMENT_SUBMITTED") {
        setStatus(r.data.status);
        router.refresh();
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [orderId, router]);
  return (
    <div className="text-center" data-testid="payment-pending">
      <Steps step={3} />
      <span className="relative mx-auto grid size-16 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/20 motion-reduce:animate-none" aria-hidden />
        <Loader2 className="size-8 animate-spin text-gold motion-reduce:animate-none" aria-hidden />
      </span>
      <h1 className="mt-5 text-3xl">Payment verification pending</h1>
      <p className="mt-3 text-fg-muted">
        We&apos;ve received your UPI reference and are matching it with our bank statement. You&apos;ll get an email as soon as it&apos;s confirmed — usually within a few hours. Your watch is reserved for you.
      </p>
      <dl className="mx-auto mt-6 grid max-w-xs grid-cols-2 gap-y-2 text-left text-sm">
        <dt className="text-fg-muted">Order</dt><dd className="text-right">{orderNumber}</dd>
        <dt className="text-fg-muted">Amount</dt><dd className="text-right">{formatINR(amount)}</dd>
        <dt className="text-fg-muted">UTR</dt><dd className="text-right font-mono">{utr}</dd>
        <dt className="text-fg-muted">Submitted</dt><dd className="text-right">{new Date(submittedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd>
      </dl>
      {status === "PAID" && <p className="mt-4 text-success">Payment confirmed!</p>}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild><Link href={`/account/orders/${orderId}`}>View order</Link></Button>
        <Button asChild variant="outline"><Link href="/watches">Continue shopping</Link></Button>
      </div>
    </div>
  );
}

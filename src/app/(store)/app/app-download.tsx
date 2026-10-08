"use client";

import { CheckCircle2, Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { clientKind } from "@/lib/client/in-app";

const noop = () => () => {};

export function AppDownload({ apkUrl, size, available, qrSvg }: { apkUrl: string; size: string | null; available: boolean; qrSvg: string | null }) {
  const mode = useSyncExternalStore(noop, clientKind, () => "loading" as const);

  if (mode === "loading") return <div className="mx-auto mt-10 h-40 max-w-xl" aria-busy />;
  if (mode === "app") {
    return (
      <p className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 border border-border bg-surface p-5 text-sm">
        <CheckCircle2 className="size-5 text-success" aria-hidden /> You&apos;re already using the app. <Link href="/" className="text-gold underline underline-offset-4">Continue shopping</Link>
      </p>
    );
  }
  if (!available) {
    return <p className="mx-auto mt-10 max-w-xl border border-border bg-surface p-5 text-center text-sm text-fg-muted">The app is on its way — check back soon.</p>;
  }
  if (mode === "ios") {
    return (
      <p className="mx-auto mt-10 max-w-xl border border-border bg-surface p-5 text-center text-sm text-fg-muted">
        The app is available for Android. On iPhone, tap <strong>Share → Add to Home Screen</strong> in Safari for the same one-tap access.
      </p>
    );
  }
  return (
    <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0 border border-border bg-surface p-5 md:p-6">
        <Button asChild size="lg" className="w-full">
          <a href={apkUrl} download data-testid="download-apk"><Download aria-hidden /> Download app{size ? ` · ${size}` : ""}</a>
        </Button>
        <ol className="mt-6 space-y-3 text-sm">
          {[
            "Tap Download, then open the file when it finishes.",
            "If Android asks, allow your browser to “Install unknown apps” (one time only).",
            "Tap Install, then Open — the boutique is now on your home screen.",
          ].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-medium text-gold">{i + 1}</span>
              <span className="text-fg-muted">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-start gap-2 text-xs text-fg-subtle">
          <ShieldCheck className="size-4 shrink-0 text-gold" aria-hidden />
          Downloaded directly from our website. The app is our boutique in an app window — sign-in, bag and orders work exactly as here.
        </p>
      </div>
      {mode === "desktop" && qrSvg && (
        <figure className="mx-auto w-48 text-center">
          <div className="border border-border bg-white p-3" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-hidden />
          <figcaption className="mt-3 text-xs text-fg-muted">On a computer? Scan with your Android phone to download.</figcaption>
        </figure>
      )}
    </div>
  );
}

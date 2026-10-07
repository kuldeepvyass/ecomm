import type { Metadata } from "next";
import { Monogram } from "@/components/brand/logo";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm">
        <Monogram className="mx-auto mb-6 size-14 text-gold" />
        <h1 className="text-4xl">You&apos;re offline</h1>
        <p className="mt-3 text-fg-muted">Time stands still for a moment. Check your connection — pages you&apos;ve visited recently are still available.</p>
        {/* Full reload on purpose: retries the network instead of a client-side transition. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-8 inline-flex min-h-12 items-center border border-gold px-6 text-xs uppercase tracking-[0.16em] text-gold">Try again</a>
      </div>
    </main>
  );
}

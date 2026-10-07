"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KEYS } from "@/lib/client/storage";

/**
 * Server-rendered so it paints with the page (not as a late, LCP-delaying pop-in). The inline head
 * script sets <html data-consent> before first paint when a choice was already made, and CSS hides it.
 * Essential cookies only (session, bag); the choice governs optional analytics if added later.
 */
export function CookieConsent() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  function choose(v: "all" | "essential") {
    try {
      localStorage.setItem(KEYS.consent, v);
    } catch {}
    document.documentElement.dataset.consent = v;
    setDismissed(true);
  }
  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie preferences" data-cookie-banner
      className="fixed inset-x-3 bottom-20 z-50 rounded-[2px] border border-border bg-surface-2 p-4 shadow-luxe md:inset-x-auto md:bottom-6 md:left-6 md:max-w-md">
      <p className="text-sm text-fg-muted">
        We use essential cookies to keep you signed in and remember your bag. Optional cookies help us improve the boutique.{" "}
        <Link href="/privacy-policy" className="text-gold underline underline-offset-4">Privacy policy</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => choose("essential")}>Essential only</Button>
        <Button size="sm" onClick={() => choose("all")}>Accept all</Button>
      </div>
    </div>
  );
}

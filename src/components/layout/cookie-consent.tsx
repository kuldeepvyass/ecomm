"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { KEYS } from "@/lib/client/storage";

const SINCE_KEY = "mh.visit-start";

/**
 * Appears after the visitor has browsed for `delayMs` (default 30 s, counted across page loads in
 * this tab) so it never interrupts the first impression. Hidden for good once a choice is made —
 * the inline head script also sets <html data-consent> before paint, and CSS hides the banner.
 * Essential cookies only (session, bag); the choice governs optional analytics if added later.
 */
export function CookieConsent({ delayMs = 30_000 }: { delayMs?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let decided = false;
    try {
      decided = Boolean(localStorage.getItem(KEYS.consent));
    } catch {}
    if (decided) return;
    let start = Date.now();
    try {
      const saved = Number(sessionStorage.getItem(SINCE_KEY));
      if (saved > 0) start = saved;
      else sessionStorage.setItem(SINCE_KEY, String(start));
    } catch {}
    const wait = Math.max(0, delayMs - (Date.now() - start));
    const t = setTimeout(() => setShow(true), wait);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!show) return null;
  function choose(v: "all" | "essential") {
    try {
      localStorage.setItem(KEYS.consent, v);
    } catch {}
    document.documentElement.dataset.consent = v;
    setShow(false);
  }
  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie preferences" data-cookie-banner
      className="fixed inset-x-3 bottom-20 z-50 animate-[fade-up_0.5s_var(--ease-luxe)_both] rounded-[2px] border border-border bg-surface-2 p-4 shadow-luxe md:inset-x-auto md:bottom-6 md:left-6 md:max-w-md">
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

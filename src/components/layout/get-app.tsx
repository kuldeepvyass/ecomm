"use client";

import { Smartphone } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { APK_URL } from "@/lib/app-download";
import { clientKind } from "@/lib/client/in-app";
import { cn } from "@/lib/utils";


/**
 * "Get the app" — decided after mount (never server-rendered) so it can't flash inside the app.
 * Hidden inside the app, on iOS, and when no APK is configured.
 */
const noop = () => () => {};

export function GetAppButton({ className }: { className?: string }) {
  // Server render (and hydration) → null; the browser then decides. Never flashes inside the app.
  const kind = useSyncExternalStore(noop, clientKind, () => null);
  if (!APK_URL || kind === null || kind === "app" || kind === "ios") return null;
  return (
    <Link href="/app" data-testid="get-app"
      className={cn("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-current/30 px-3 text-[0.6875rem] font-medium uppercase tracking-[0.12em] transition-colors hover:border-gold hover:text-gold", className)}>
      <Smartphone className="size-4" aria-hidden />
      <span>App</span>
      <span className="sr-only"> — download the Android app</span>
    </Link>
  );
}

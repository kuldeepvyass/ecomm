"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    (globalThis as { Sentry?: { captureException: (e: unknown) => void } }).Sentry?.captureException(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="mt-3 text-fg-muted">Please try again. If it keeps happening, contact client services{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
        <Button className="mt-8" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Monogram } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <Monogram className="mx-auto mb-6 size-14 text-gold" />
        <p className="eyebrow text-gold">404</p>
        <h1 className="mt-2 text-4xl md:text-5xl">This page has slipped its strap</h1>
        <p className="mt-3 text-fg-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild><Link href="/watches">Browse watches</Link></Button>
          <Button asChild variant="outline"><Link href="/">Home</Link></Button>
        </div>
      </div>
    </main>
  );
}

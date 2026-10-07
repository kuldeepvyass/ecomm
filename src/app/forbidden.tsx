import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="eyebrow text-gold">403</p>
        <h1 className="mt-2 text-4xl">Restricted area</h1>
        <p className="mt-3 text-fg-muted">This page is only available to store administrators.</p>
        <Button asChild className="mt-8"><Link href="/">Back to the boutique</Link></Button>
      </div>
    </main>
  );
}

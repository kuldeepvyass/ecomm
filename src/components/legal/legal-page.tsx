import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export function LegalPage({ title, eyebrow, updated, children }: { title: string; eyebrow?: string; updated?: string; children: ReactNode }) {
  return (
    <div className="container-luxe py-8 md:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />
      <article className="mx-auto max-w-3xl">
        {eyebrow && <p className="eyebrow mb-3 text-gold">{eyebrow}</p>}
        <h1 className="text-4xl md:text-6xl">{title}</h1>
        {updated && <p className="mt-3 text-sm text-fg-subtle">Last updated {updated}</p>}
        <div className="prose-luxe mt-10">{children}</div>
      </article>
    </div>
  );
}

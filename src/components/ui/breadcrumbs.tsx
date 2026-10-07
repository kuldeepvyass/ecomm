import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 overflow-x-auto no-scrollbar">
      <ol className="flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3 text-fg-subtle" aria-hidden />}
            {it.href ? (
              <Link href={it.href} className="inline-flex min-h-8 items-center hover:text-gold">{it.label}</Link>
            ) : (
              <span aria-current="page" className="text-fg">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

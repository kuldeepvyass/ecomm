import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getBrands } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "Our Maisons", description: "The watchmakers we represent." };

export default async function BrandsPage() {
  const brands = (await getBrands()).filter((b) => b._count.products > 0);
  return (
    <div className="container-luxe py-8 md:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Maisons" }]} />
      <h1 className="mb-10 text-5xl md:text-7xl">Our Maisons</h1>
      <ul className="divide-y divide-border border-y border-border">
        {brands.map((b) => (
          <li key={b.id}>
            <Link href={`/watches/${b.slug}`} className="group grid gap-3 py-8 md:grid-cols-[1fr_2fr_auto] md:items-center md:gap-10">
              <div>
                <h2 className="text-3xl transition-colors group-hover:text-gold md:text-4xl">{b.name}</h2>
                {b.tagline && <p className="eyebrow mt-2 text-fg-muted">{b.tagline}</p>}
              </div>
              {b.story && <p className="text-fg-muted">{b.story}</p>}
              <span className="eyebrow inline-flex items-center gap-2 text-gold">{b._count.products} watches <ArrowRight className="size-4" aria-hidden /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

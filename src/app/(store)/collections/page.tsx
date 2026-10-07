import type { Metadata } from "next";
import Link from "next/link";
import { WatchImage } from "@/components/product/watch-image";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getCollections } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "Collections", description: "Dress, dive, chronograph and limited-edition watches, curated." };

export default async function CollectionsPage() {
  const collections = await getCollections();
  return (
    <div className="container-luxe py-8 md:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Collections" }]} />
      <h1 className="mb-10 text-5xl md:text-7xl">Curated Collections</h1>
      <ul className="grid gap-4 md:grid-cols-2 md:gap-8">
        {collections.map((c) => (
          <li key={c.id}>
            <Link href={`/collections/${c.slug}`} className="group relative flex aspect-[4/3] items-end overflow-hidden bg-surface-2 p-6 md:p-10">
              {c.heroImage && <WatchImage src={c.heroImage} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-[1200ms] group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
              <div className="relative text-[#f5f1ea]">
                <h2 className="text-4xl md:text-5xl">{c.name}</h2>
                {c.description && <p className="mt-2 max-w-md text-sm text-[#d8d2c8]">{c.description}</p>}
                <p className="eyebrow mt-4 text-[#dcc08c]">{c._count.products} pieces</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing } from "@/components/listing/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getBrands } from "@/server/catalog/queries";

async function findBrand(slug: string) {
  return (await getBrands()).find((b) => b.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/watches/[brand]">): Promise<Metadata> {
  const brand = await findBrand((await params).brand);
  if (!brand) return {};
  return {
    title: `${brand.name} Watches`,
    description: brand.tagline ?? `Discover ${brand.name} watches at Maison Horlogère.`,
    alternates: { canonical: `/watches/${brand.slug}` },
  };
}

export default async function BrandPage({ params, searchParams }: PageProps<"/watches/[brand]">) {
  const [{ brand: slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await findBrand(slug);
  if (!brand) notFound();
  return (
    <div className="container-luxe py-8 md:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/brands", label: "Maisons" }, { label: brand.name }]} />
      <header className="mb-10 max-w-3xl md:mb-14">
        {brand.tagline && <p className="eyebrow mb-3 text-gold">{brand.tagline}</p>}
        <h1 className="text-5xl md:text-7xl">{brand.name}</h1>
        {brand.story && <p className="mt-5 text-lg text-fg-muted">{brand.story}</p>}
      </header>
      <Listing searchParams={sp} fixed={{ brand: brand.slug }} lock={{ brand: true }} />
    </div>
  );
}

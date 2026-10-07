import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing } from "@/components/listing/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getCollections } from "@/server/catalog/queries";

async function findCollection(slug: string) {
  return (await getCollections()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const c = await findCollection((await params).slug);
  if (!c) return {};
  return { title: `${c.name} Watches`, description: c.description ?? undefined, alternates: { canonical: `/collections/${c.slug}` } };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await findCollection(slug);
  if (!c) notFound();
  return (
    <div className="container-luxe py-8 md:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/collections", label: "Collections" }, { label: c.name }]} />
      <header className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3 text-gold">Collection</p>
        <h1 className="text-5xl md:text-7xl">{c.name}</h1>
        {c.description && <p className="mt-4 text-lg text-fg-muted">{c.description}</p>}
      </header>
      <Listing searchParams={sp} fixed={{ collection: c.slug }} />
    </div>
  );
}

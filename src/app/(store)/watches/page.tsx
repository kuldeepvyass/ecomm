import type { Metadata } from "next";
import { Listing } from "@/components/listing/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export async function generateMetadata({ searchParams }: PageProps<"/watches">): Promise<Metadata> {
  const sp = await searchParams;
  const g = sp.gender === "MEN" ? "Men's " : sp.gender === "WOMEN" ? "Women's " : "";
  return {
    title: `${g}Luxury Watches`,
    description: `Shop ${g.toLowerCase()}luxury watches — automatic, chronograph, dive and dress watches. Authenticity guaranteed, insured shipping across India.`,
    alternates: { canonical: "/watches" },
  };
}

export default async function WatchesPage({ searchParams }: PageProps<"/watches">) {
  const sp = await searchParams;
  const title = sp.gender === "MEN" ? "Watches for Him" : sp.gender === "WOMEN" ? "Watches for Her" : "All Watches";
  return (
    <div className="container-luxe py-8 md:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />
      <h1 className="mb-8 text-4xl md:text-6xl">{title}</h1>
      <Listing searchParams={sp} />
    </div>
  );
}

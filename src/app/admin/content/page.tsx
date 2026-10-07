import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ContentEditor } from "./content-editor";

export const metadata: Metadata = { title: "Homepage" };

export default async function Content() {
  await requireAdmin();
  const [banners, collections] = await Promise.all([
    db.homeBanner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <div>
      <PageHeader title="Homepage" description="Hero, brand-story strips and curated collections — changes go live within seconds, no code needed." />
      <ContentEditor
        banners={banners.map((b) => ({ id: b.id, placement: b.placement as "HERO" | "STRIP" | "STORY", eyebrow: b.eyebrow ?? "", title: b.title, subtitle: b.subtitle ?? "", imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl ?? "", videoUrl: b.videoUrl ?? "", ctaLabel: b.ctaLabel ?? "", ctaHref: b.ctaHref ?? "", position: b.position, active: b.active }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name, description: c.description ?? "", heroImage: c.heroImage ?? "", sortOrder: c.sortOrder, showOnHome: c.showOnHome, count: c._count.products }))} />
    </div>
  );
}

import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const revalidate = 3600;

/** Real, live catalogue only — sample (isDemo) items and drafts are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  const [products, brands, collections] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE", deletedAt: null, isDemo: false }, select: { slug: true, updatedAt: true, brand: { select: { slug: true } }, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } }),
    db.brand.findMany({ where: { isDemo: false, products: { some: { status: "ACTIVE", deletedAt: null, isDemo: false } } }, select: { slug: true, updatedAt: true } }),
    db.collection.findMany({ where: { products: { some: { product: { status: "ACTIVE", deletedAt: null, isDemo: false } } } }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["", "/watches", "/collections", "/brands", "/about", "/contact", "/authenticity", "/faq", "/shipping-policy", "/refund-policy", "/privacy-policy", "/terms"];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...brands.map((b) => ({ url: `${base}/watches/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/watches/${p.brand.slug}/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.9, images: p.images.map((i) => i.url) })),
  ];
}

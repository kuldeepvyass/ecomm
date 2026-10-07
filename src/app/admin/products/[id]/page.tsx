import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { productFormContext } from "../load";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProduct({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [p, ctx, history] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { brand: true, images: { orderBy: { position: "asc" } }, collections: { include: { collection: true } } } }),
    productFormContext(),
    db.priceChangeLog.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { email: true } } } }),
  ]);
  if (!p) notFound();
  const n = (d: unknown) => (d === null || d === undefined ? "" : String(Number(d)));
  return (
    <div>
      <PageHeader title={`${p.brand.name} ${p.modelName}`} description={`${p.sku} · ${p.isDemo ? "Sample product · " : ""}${p.deletedAt ? "In trash" : p.status === "ACTIVE" ? "Live" : "Draft"}`} />
      <ProductForm id={p.id} {...ctx} viewUrl={p.status === "ACTIVE" && !p.deletedAt ? `/watches/${p.brand.slug}/${p.slug}` : undefined}
        initialImages={p.images.map((i) => ({ url: i.url, publicId: i.publicId, alt: i.alt, width: i.width, height: i.height, blurDataUrl: i.blurDataUrl }))}
        initial={{
          brand: p.brand.name, modelName: p.modelName, referenceNumber: p.referenceNumber, sku: p.sku, slug: p.slug, gender: p.gender, description: p.description,
          mrp: String(p.mrp), costPrice: p.costPrice === null ? "" : String(p.costPrice), discountOverridePct: n(p.discountOverridePct),
          excludeFromGlobalDiscount: p.excludeFromGlobalDiscount, stock: String(p.stock), lowStockAt: String(p.lowStockAt), hsnCode: p.hsnCode, gstRatePct: n(p.gstRatePct),
          caseMaterial: p.caseMaterial, caseDiameterMm: n(p.caseDiameterMm), caseThicknessMm: n(p.caseThicknessMm), lugWidthMm: n(p.lugWidthMm),
          dialColour: p.dialColour, strapMaterial: p.strapMaterial, strapColour: p.strapColour ?? "", movement: p.movement, calibre: p.calibre ?? "",
          powerReserveHours: n(p.powerReserveHours), waterResistanceM: n(p.waterResistanceM), crystal: p.crystal ?? "", weightGrams: n(p.weightGrams),
          warrantyMonths: n(p.warrantyMonths), boxAndPapers: p.boxAndPapers, status: p.status, featured: p.featured, seoTitle: p.seoTitle ?? "",
          seoDescription: p.seoDescription ?? "", externalRating: n(p.externalRating), externalRatingCount: n(p.externalRatingCount),
          externalRatingSource: p.externalRatingSource ?? "", series: p.series ?? "", brandOrigin: p.brand.origin ?? "", watchType: p.watchType ?? "",
          caseShape: p.caseShape ?? "", functions: p.functions ?? "", specialFeatures: p.specialFeatures ?? "", collections: p.collections.map((c) => c.collection.name),
        }} />
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-2xl">Price history</h2>
          <ul className="divide-y divide-border border-y border-border text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{h.oldPrice !== null && h.newPrice !== null ? `${formatINR(h.oldPrice)} → ${formatINR(h.newPrice)}` : `${h.oldValue} → ${h.newValue}`} <span className="text-fg-muted">({h.scope.toLowerCase().replace(/_/g, " ")})</span></span>
                <span className="text-fg-muted">{h.actor.email} · {h.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

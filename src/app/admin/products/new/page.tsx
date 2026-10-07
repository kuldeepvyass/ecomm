import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/session";
import { productFormContext } from "../load";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProduct() {
  await requireAdmin();
  const ctx = await productFormContext();
  return (
    <div>
      <PageHeader title="Add product" />
      <ProductForm {...ctx} initialImages={[]} initial={{
        brand: "", modelName: "", referenceNumber: "", sku: "", slug: "", gender: "MEN", description: "", mrp: "", costPrice: "",
        discountOverridePct: "", excludeFromGlobalDiscount: false, stock: "1", lowStockAt: "2", hsnCode: "9102", gstRatePct: "18",
        caseMaterial: "", caseDiameterMm: "", caseThicknessMm: "", lugWidthMm: "", dialColour: "", strapMaterial: "", strapColour: "",
        movement: "AUTOMATIC", calibre: "", powerReserveHours: "", waterResistanceM: "", crystal: "Sapphire", weightGrams: "", warrantyMonths: "24",
        boxAndPapers: true, status: "DRAFT", featured: false, seoTitle: "", seoDescription: "", externalRating: "", externalRatingCount: "", externalRatingSource: "", series: "", brandOrigin: "", watchType: "", caseShape: "Round", functions: "", specialFeatures: "",
        collections: [],
      }} />
    </div>
  );
}

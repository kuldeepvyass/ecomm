import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = { title: "Products" };
const PAGE = 25;

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const view = sp.view === "trash" ? "trash" : sp.view === "draft" ? "draft" : sp.view === "active" ? "active" : sp.view === "low" ? "low" : "all";
  const brand = typeof sp.brand === "string" ? sp.brand : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  const where: Prisma.ProductWhereInput = {
    deletedAt: view === "trash" ? { not: null } : null,
    ...(view === "draft" ? { status: "DRAFT" } : view === "active" ? { status: "ACTIVE" } : {}),
    ...(view === "low" ? { stock: { lte: 2 } } : {}),
    ...(brand ? { brand: { slug: brand } } : {}),
    ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { modelName: { contains: q, mode: "insensitive" } }, { referenceNumber: { contains: q, mode: "insensitive" } }, { brand: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total, brands, counts] = await Promise.all([
    db.product.findMany({
      where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: PAGE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, sku: true, modelName: true, referenceNumber: true, slug: true, mrp: true, sellingPrice: true, stock: true, status: true, featured: true,
        isDemo: true, deletedAt: true, effectiveDiscountPct: true, brand: { select: { name: true, slug: true } },
        images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
      },
    }),
    db.product.count({ where }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    db.product.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);
  const items = rows.slice(0, PAGE).map((r) => ({ ...r, effectiveDiscountPct: Number(r.effectiveDiscountPct), image: r.images[0]?.url ?? null }));
  const next = rows.length > PAGE ? items[items.length - 1].id : null;
  const active = counts.find((c) => c.status === "ACTIVE")?._count ?? 0;
  const draft = counts.find((c) => c.status === "DRAFT")?._count ?? 0;

  return (
    <div>
      <PageHeader title="Products" description={`${active} active · ${draft} draft`}
        actions={<>
          <Button asChild variant="outline" size="sm"><Link href="/admin/products/import"><Upload aria-hidden /> Import / export</Link></Button>
          <Button asChild size="sm"><Link href="/admin/products/new"><Plus aria-hidden /> Add product</Link></Button>
        </>} />
      <ProductsTable items={items} total={total} next={next} brands={brands} view={view} q={q} brand={brand} />
    </div>
  );
}

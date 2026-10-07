"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/admin/action-button";
import { SingleImage } from "@/components/admin/single-image";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { deleteBanner, saveBanner, saveCollection } from "@/server/actions/admin/store";

type Banner = { id?: string; placement: "HERO" | "STRIP" | "STORY" | "SHOP_BY"; eyebrow: string; title: string; subtitle: string; imageUrl: string; mobileImageUrl: string; videoUrl: string; ctaLabel: string; ctaHref: string; position: number; active: boolean };
type Coll = { id?: string; name: string; description: string; heroImage: string; sortOrder: number; showOnHome: boolean; count?: number };

export function ContentEditor({ banners, collections }: { banners: Banner[]; collections: Coll[] }) {
  const router = useRouter();
  const [b, setB] = useState<Banner | null>(null);
  const [c, setC] = useState<Coll | null>(null);
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, close: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(r.message ?? "Saved"); close(); router.refresh(); } else toast.error(r.error); });

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl">Banners</h2>
          <Button size="sm" onClick={() => setB({ placement: "HERO", eyebrow: "", title: "", subtitle: "", imageUrl: "", mobileImageUrl: "", videoUrl: "", ctaLabel: "", ctaHref: "/watches", position: 0, active: true })}><Plus aria-hidden /> Add banner</Button></div>
        <ul className="grid gap-3 md:grid-cols-2">
          {banners.map((x) => (
            <li key={x.id} className="flex gap-4 border border-border p-3">
              <div className="aspect-video w-32 shrink-0 bg-surface-2 bg-cover bg-center" style={{ backgroundImage: `url(${x.imageUrl}${x.imageUrl.includes("?") ? "&" : "?"}w=300)` }} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex gap-1"><Badge tone="outline">{x.placement.toLowerCase()}</Badge>{!x.active && <Badge tone="danger">Hidden</Badge>}</div>
                <p className="mt-1 truncate font-medium">{x.title}</p>
                <div className="mt-2 flex gap-2"><Button size="sm" variant="ghost" onClick={() => setB(x)}>Edit</Button><ActionButton size="sm" variant="ghost" className="text-danger" confirmText="Delete banner?" action={() => deleteBanner(x.id!)}>Delete</ActionButton></div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl">Curated collections</h2>
          <Button size="sm" onClick={() => setC({ name: "", description: "", heroImage: "", sortOrder: collections.length + 1, showOnHome: true })}><Plus aria-hidden /> Add collection</Button></div>
        <ul className="grid gap-3 md:grid-cols-2">
          {collections.map((x) => (
            <li key={x.id} className="flex items-center gap-4 border border-border p-3 text-sm">
              <div className="aspect-[3/4] w-16 shrink-0 bg-surface-2 bg-cover bg-center" style={{ backgroundImage: x.heroImage ? `url(${x.heroImage}${x.heroImage.includes("?") ? "&" : "?"}w=200)` : undefined }} />
              <div className="flex-1"><p className="font-medium">{x.name}</p><p className="text-xs text-fg-muted">{x.count} products · order {x.sortOrder}{x.showOnHome ? " · on homepage" : ""}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setC(x)}>Edit</Button>
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={!!b} onOpenChange={(o) => !o && setB(null)} title={b?.id ? "Edit banner" : "New banner"}
        footer={<Button block loading={pending} onClick={() => b && save(() => saveBanner(b), () => setB(null))}>Save banner</Button>}>
        {b && (
          <div className="flex flex-col gap-4">
            <Field label="Placement">{(p) => <Select {...p} value={b.placement} onChange={(e) => setB({ ...b, placement: e.target.value as Banner["placement"] })}><option value="HERO">Hero (top of homepage)</option><option value="STORY">Brand story strip</option><option value="STRIP">Promo strip</option><option value="SHOP_BY">Shop by tile (For Him / For Her)</option></Select>}</Field>
            <SingleImage label="Image (desktop, wide)" value={b.imageUrl} onChange={(u) => setB({ ...b, imageUrl: u })} />
            <SingleImage label="Image (mobile, portrait — optional)" value={b.mobileImageUrl} onChange={(u) => setB({ ...b, mobileImageUrl: u })} />
            <Field label="Eyebrow">{(p) => <Input {...p} value={b.eyebrow} onChange={(e) => setB({ ...b, eyebrow: e.target.value })} />}</Field>
            <Field label="Title" required>{(p) => <Input {...p} value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} />}</Field>
            <Field label="Subtitle">{(p) => <Textarea {...p} rows={2} value={b.subtitle} onChange={(e) => setB({ ...b, subtitle: e.target.value })} />}</Field>
            <Field label="Muted background video URL (optional, hero only)">{(p) => <Input {...p} type="url" value={b.videoUrl} onChange={(e) => setB({ ...b, videoUrl: e.target.value })} placeholder="https://res.cloudinary.com/…/hero.mp4" />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Button label">{(p) => <Input {...p} value={b.ctaLabel} onChange={(e) => setB({ ...b, ctaLabel: e.target.value })} />}</Field>
              <Field label="Button link">{(p) => <Input {...p} value={b.ctaHref} onChange={(e) => setB({ ...b, ctaHref: e.target.value })} />}</Field>
            </div>
            <Field label="Order">{(p) => <Input {...p} inputMode="numeric" value={String(b.position)} onChange={(e) => setB({ ...b, position: Number(e.target.value.replace(/\D/g, "")) || 0 })} />}</Field>
            <Checkbox label="Visible" checked={b.active} onChange={(e) => setB({ ...b, active: e.target.checked })} />
          </div>
        )}
      </Sheet>
      <Sheet open={!!c} onOpenChange={(o) => !o && setC(null)} title={c?.id ? "Edit collection" : "New collection"}
        footer={<Button block loading={pending} onClick={() => c && save(() => saveCollection(c), () => setC(null))}>Save collection</Button>}>
        {c && (
          <div className="flex flex-col gap-4">
            <Field label="Name" required>{(p) => <Input {...p} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />}</Field>
            <Field label="Description">{(p) => <Textarea {...p} rows={3} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />}</Field>
            <SingleImage label="Cover image (portrait)" value={c.heroImage} onChange={(u) => setC({ ...c, heroImage: u })} />
            <Field label="Order">{(p) => <Input {...p} inputMode="numeric" value={String(c.sortOrder)} onChange={(e) => setC({ ...c, sortOrder: Number(e.target.value.replace(/\D/g, "")) || 0 })} />}</Field>
            <Checkbox label="Show on homepage" checked={c.showOnHome} onChange={(e) => setC({ ...c, showOnHome: e.target.checked })} />
            <p className="text-xs text-fg-muted">Assign products to collections from each product&apos;s edit page or the importer&apos;s <code>collections</code> column.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { cdnLoader } from "@/lib/image-loader";

export function SingleImage({ value, onChange, purpose = "banners", label }: { value: string; onChange: (url: string) => void; purpose?: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-fg-muted">{label}</span>
      <label className="relative flex aspect-[16/9] cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border-strong bg-surface-2 text-sm text-fg-muted hover:border-gold">
        {value ? <Image loader={cdnLoader} src={value} alt="" fill sizes="400px" className="object-cover" /> : null}
        <span className="relative flex items-center gap-2 bg-bg/80 px-3 py-2">{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}{value ? "Replace" : "Upload"}</span>
        <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          const fd = new FormData(); fd.set("file", f); fd.set("purpose", purpose);
          const res = await fetch("/api/uploads", { method: "POST", body: fd });
          const data = await res.json();
          setBusy(false);
          if (res.ok) onChange(data.url); else toast.error(data.error);
        }} />
      </label>
    </div>
  );
}

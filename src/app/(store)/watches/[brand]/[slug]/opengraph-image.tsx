import { ImageResponse } from "next/og";
import { isLinkedImage } from "@/lib/image-loader";
import { formatINR } from "@/lib/money";
import { getProductBySlug } from "@/server/catalog/queries";

export const alt = "Watch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOG({ params }: { params: Promise<{ brand: string; slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  const img = p?.images[0]?.url;
  const src = img ? await ogImageSrc(img) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0a09", color: "#f5f1ea" }}>
        {src && <img src={src} width={630} height={630} style={{ objectFit: isLinkedImage(img) ? "contain" : "cover", background: "#ffffff" }} alt="" />}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 56 }}>
          <div style={{ fontSize: 22, letterSpacing: 8, color: "#c9a96e" }}>{(p?.brand.name ?? "MAISON HORLOGÈRE").toUpperCase()}</div>
          <div style={{ marginTop: 16, fontSize: 54, fontFamily: "serif", lineHeight: 1.05 }}>{p?.modelName ?? "Fine watches"}</div>
          {p && <div style={{ marginTop: 12, fontSize: 22, color: "#a39e95" }}>Ref. {p.referenceNumber} · {p.caseDiameterMm} mm</div>}
          {p && <div style={{ marginTop: 36, fontSize: 40 }}>{formatINR(p.sellingPrice)}</div>}
          <div style={{ marginTop: 40, fontSize: 20, letterSpacing: 6, color: "#a39e95" }}>MAISON HORLOGÈRE</div>
        </div>
      </div>
    ),
    size,
  );
}

/** Linked photos are fetched once here (with a timeout) so a slow or hotlink-blocking host can't break the card. */
async function ogImageSrc(img: string): Promise<string | null> {
  if (img.startsWith("https://images.unsplash.com/")) return `${img}${img.includes("?") ? "&" : "?"}w=630&h=630&fit=crop&fm=jpg&q=80`.replace("ar=4:5&", "");
  if (!/^https?:/i.test(img)) return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"}${img}`;
  try {
    const res = await fetch(img, { signal: AbortSignal.timeout(5000), headers: { Accept: "image/jpeg,image/png,image/*" } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    return `data:${type.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

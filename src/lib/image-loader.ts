import type { ImageLoaderProps } from "next/image";

/**
 * CDN-native resizing: Cloudinary and Unsplash (imgix) both negotiate AVIF/WebP and resize
 * at the edge, so we skip Next's optimizer for them (no double work, no Vercel image quota).
 */
export function cdnLoader({ src, width, quality }: ImageLoaderProps): string {
  const q = quality ?? 75;
  if (src.startsWith("https://res.cloudinary.com/")) {
    return src.replace("/upload/", `/upload/f_auto,q_auto:good,c_limit,w_${width}/`);
  }
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(q));
    url.searchParams.set("auto", "format");
    return url.toString();
  }
  // Local uploads / other hosts go through Next's built-in optimizer.
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
}

/**
 * Same-origin loader for LCP images: avoids a DNS+TCP+TLS handshake to a third-party CDN before the
 * most important image can start downloading. Next's optimizer serves AVIF/WebP and caches at the edge.
 */
export function sameOriginLoader({ src, width, quality }: ImageLoaderProps): string {
  const base = src.startsWith("https://images.unsplash.com/") ? (() => { const u = new URL(src); u.searchParams.set("w", String(Math.min(width * 2, 2400))); return u.toString(); })() : src;
  return `/_next/image?url=${encodeURIComponent(base)}&w=${width}&q=${quality ?? 75}`;
}

const RESIZING_HOSTS = ["https://res.cloudinary.com/", "https://images.unsplash.com/", "https://images.pexels.com/", "https://lh3.googleusercontent.com/"];

/**
 * Product photos imported as links (any other https host) are shown straight from their own host:
 * no download, no resizing on our server. `no-referrer` because many retail CDNs block hotlinks
 * that carry a foreign Referer but serve referrer-less requests.
 */
export function isLinkedImage(src: unknown): src is string {
  return typeof src === "string" && /^https?:\/\//i.test(src) && !RESIZING_HOSTS.some((h) => src.startsWith(h));
}

export const LINKED_IMAGE_PROPS = { unoptimized: true, referrerPolicy: "no-referrer" } as const;

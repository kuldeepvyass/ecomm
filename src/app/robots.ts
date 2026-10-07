import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/bag", "/api/", "/sign-in", "/search", "/compare", "/wishlist", "/dev/", "/offline"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

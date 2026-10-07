import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  // Next.js inline bootstrap. (Nonces would force every page dynamic and defeat ISR.)
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  // Product photos can be linked from any https host (imported datasets), so img-src allows https:.
  "img-src 'self' data: blob: https:",
  "media-src 'self' https://res.cloudinary.com https://videos.pexels.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io",
  "frame-src 'none'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lets phones on the same Wi-Fi open the dev server by IP (dev-only; ignored in production).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  turbopack: { root: import.meta.dirname },
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },
  serverExternalPackages: ["@react-pdf/renderer", "exceljs", "pino"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 65, 75, 85],
    deviceSizes: [375, 430, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;

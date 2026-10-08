import { stat } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Monogram } from "@/components/brand/logo";
import { APK_URL } from "@/lib/app-download";
import { AppDownload } from "./app-download";

export const metadata: Metadata = {
  title: "Get the Android app",
  description: "Install the Maison Horlogère app on your Android phone — the full boutique, one tap away.",
};

/** Size of an APK served from /public, e.g. "5.8 MB"; null for external links or a missing file. */
async function localApkSize(url: string) {
  if (!url.startsWith("/")) return null;
  try {
    const { size } = await stat(path.join(process.cwd(), "public", decodeURIComponent(url.split("?")[0])));
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  } catch {
    return null;
  }
}

export default async function AppPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const size = APK_URL ? await localApkSize(APK_URL) : null;
  const available = Boolean(APK_URL) && (!APK_URL.startsWith("/") || size !== null);
  // Desktop visitors scan this with their phone and land on this page, ready to download.
  const qr = available ? await QRCode.toString(`${origin}/app`, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0b0a09", light: "#ffffff" } }) : null;

  return (
    <div className="container-luxe py-14 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <Monogram className="mx-auto mb-6 size-14 text-gold" />
        <p className="eyebrow text-gold">Android app</p>
        <h1 className="mt-3 text-4xl md:text-6xl">The boutique, in your pocket</h1>
        <p className="mt-4 text-fg-muted">Browse new arrivals, keep your wishlist and track orders — the full Maison Horlogère experience, one tap from your home screen.</p>
      </div>
      <AppDownload apkUrl={APK_URL} size={size} available={available} qrSvg={qr} />
    </div>
  );
}

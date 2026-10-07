import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

export type UploadedImage = { url: string; publicId: string; width: number; height: number; blurDataUrl: string };

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

function cloudinaryReady() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
}

/**
 * Validates by decoding (not by trusting the file extension/MIME), normalises orientation,
 * strips metadata, caps size at 2400px, then stores on Cloudinary — or public/uploads on localhost.
 */
export async function storeImage(input: Buffer, folder: "products" | "reviews" | "banners" | "brand" | "payments"): Promise<UploadedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 10 MB.");
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.format || !ALLOWED.has(meta.format)) throw new Error("Unsupported image. Use JPG, PNG, WebP or AVIF.");
  const processed = await sharp(input).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  const tiny = await sharp(processed.data).resize(10).jpeg({ quality: 50 }).toBuffer();
  const blurDataUrl = `data:image/jpeg;base64,${tiny.toString("base64")}`;

  if (cloudinaryReady()) {
    const res = await new Promise<{ secure_url: string; public_id: string; width: number; height: number }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `maison/${folder}`, resource_type: "image" }, (err, r) => (err || !r ? reject(err ?? new Error("upload failed")) : resolve(r)))
        .end(processed.data);
    });
    return { url: res.secure_url, publicId: res.public_id, width: res.width, height: res.height, blurDataUrl };
  }

  if (process.env.NODE_ENV === "production" && process.env.E2E_TEST_MODE !== "1") {
    throw new Error("Image storage isn't configured. Add Cloudinary credentials.");
  }
  const name = `${randomUUID()}.webp`;
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), processed.data);
  return { url: `/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}`, width: processed.info.width, height: processed.info.height, blurDataUrl };
}

export async function deleteStoredImage(publicId: string | null | undefined) {
  if (!publicId) return;
  try {
    if (publicId.startsWith("local:")) {
      await unlink(path.join(process.cwd(), "public", "uploads", publicId.slice(6)));
    } else if (cloudinaryReady()) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch {
    /* already gone */
  }
}

/** Fetches a remote image (for bulk import "image URL" columns) with size/time limits. */
export async function fetchRemoteImage(url: string): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) image URLs are allowed.");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)) throw new Error("Private network URLs are not allowed.");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (!res.ok) throw new Error(`Image download failed (${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 10 MB.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 10 MB.");
  return buf;
}

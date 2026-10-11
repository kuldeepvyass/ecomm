import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { mediaDir } from "@/server/uploads";

const TYPES: Record<string, string> = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif" };

/**
 * Serves locally stored uploads. In production Nginx answers /media/ straight from disk; this route
 * covers dev and the image optimizer's internal fetches. Names are random UUIDs, so cache forever.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts.length || parts.some((p) => !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(p))) return new Response("Not found", { status: 404 });
  const root = path.resolve(mediaDir());
  const file = path.resolve(root, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error("not a file");
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { "Content-Type": type, "Content-Length": String(s.size), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

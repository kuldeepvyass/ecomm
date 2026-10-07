import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";

export const getBanners = unstable_cache(
  async (placement: "HERO" | "STRIP" | "STORY") => {
    const now = new Date();
    return db.homeBanner.findMany({
      where: {
        placement,
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: "asc" },
    });
  },
  ["banners"],
  { tags: [TAGS.home], revalidate: 3600 },
);

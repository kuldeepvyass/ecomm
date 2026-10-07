/* eslint-disable no-console */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { priceFor } from "../src/lib/pricing";
import { strapTypeOf } from "../src/lib/catalog/classify";
import { TEST_ACCOUNTS } from "../src/lib/dev/test-accounts";
import { buildSearchText } from "../src/lib/text";
import {
  BRANDS, COLLECTIONS, COLLECTION_IMAGES, HERO_IMAGE, HERO_IMAGE_MOBILE, HERO_VIDEO, PRODUCTS, REVIEWER_NAMES,
  REVIEW_PHOTOS, REVIEW_TEMPLATES, STORY_IMAGE, imageUrl,
} from "./seed-data";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Deterministic PRNG so re-seeding produces the same sample data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function blurFor(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}&w=24&q=40&fm=jpg`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const tiny = await sharp(buf).resize(10).jpeg({ quality: 50 }).toBuffer();
    return `data:image/jpeg;base64,${tiny.toString("base64")}`;
  } catch {
    return null;
  }
}

async function seedSettings() {
  await db.storeSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      storeName: "Maison Horlogère",
      contactEmail: "concierge@maisonhorlogere.in",
      contactPhone: "+91 00000 00000",
      addressLine: "Boutique address — set in Admin → Settings",
      stateCode: "MH",
      globalDiscountPct: 5,
      returnWindowDays: 7,
      shippingFee: 500,
      freeShippingThreshold: 50000,
      defaultDeliveryDays: 5,
      expressShippingFee: 1500,
    },
    update: {},
  });

  const zones = [
    { pinPrefix: "1", label: "North India", minDays: 3, maxDays: 5 },
    { pinPrefix: "110", label: "Delhi NCR", minDays: 2, maxDays: 3 },
    { pinPrefix: "2", label: "Uttar Pradesh & Uttarakhand", minDays: 3, maxDays: 6 },
    { pinPrefix: "3", label: "Rajasthan & Gujarat", minDays: 3, maxDays: 5 },
    { pinPrefix: "4", label: "Maharashtra, MP, Chhattisgarh & Goa", minDays: 2, maxDays: 4 },
    { pinPrefix: "400", label: "Mumbai", minDays: 1, maxDays: 2 },
    { pinPrefix: "411", label: "Pune", minDays: 1, maxDays: 3 },
    { pinPrefix: "5", label: "Andhra Pradesh, Telangana & Karnataka", minDays: 3, maxDays: 5 },
    { pinPrefix: "560", label: "Bengaluru", minDays: 2, maxDays: 3 },
    { pinPrefix: "500", label: "Hyderabad", minDays: 2, maxDays: 3 },
    { pinPrefix: "6", label: "Tamil Nadu & Kerala", minDays: 3, maxDays: 5 },
    { pinPrefix: "600", label: "Chennai", minDays: 2, maxDays: 3 },
    { pinPrefix: "7", label: "East India", minDays: 4, maxDays: 6 },
    { pinPrefix: "700", label: "Kolkata", minDays: 2, maxDays: 4 },
    { pinPrefix: "78", label: "North East", minDays: 6, maxDays: 9 },
    { pinPrefix: "79", label: "North East", minDays: 6, maxDays: 9 },
    { pinPrefix: "8", label: "Bihar & Jharkhand", minDays: 4, maxDays: 6 },
    { pinPrefix: "9", label: "Army Postal Service", minDays: 0, maxDays: 0, serviceable: false },
  ];
  for (const z of zones) await db.shippingZone.upsert({ where: { pinPrefix: z.pinPrefix }, create: z, update: z });

  await db.coupon.upsert({
    where: { code: "WELCOME10" },
    create: { code: "WELCOME10", description: "10% off your first order (up to ₹5,000)", type: "PERCENT", value: 10, maxDiscount: 5000, perUserLimit: 1 },
    update: {},
  });
  await db.coupon.upsert({
    where: { code: "FLAT2000" },
    create: { code: "FLAT2000", description: "₹2,000 off orders above ₹50,000", type: "FLAT", value: 2000, minOrderValue: 50000, perUserLimit: 2 },
    update: {},
  });

  for (const c of COLLECTIONS) {
    await db.collection.upsert({
      where: { slug: c.slug },
      create: { ...c, heroImage: COLLECTION_IMAGES[c.slug] },
      update: { heroImage: COLLECTION_IMAGES[c.slug] },
    });
  }

  if ((await db.homeBanner.count()) === 0) {
    await db.homeBanner.createMany({
      data: [
        {
          placement: "HERO", position: 0, eyebrow: "The Autumn Collection", title: "Time, Mastered.",
          subtitle: "Exceptional timepieces from independent maisons — authenticated, insured and delivered across India.",
          imageUrl: HERO_IMAGE, mobileImageUrl: HERO_IMAGE_MOBILE, videoUrl: HERO_VIDEO, ctaLabel: "Explore the collection", ctaHref: "/watches",
        },
        {
          placement: "STORY", position: 0, eyebrow: "Savoir-faire", title: "Every bridge, on display.",
          subtitle: "Open-worked movements, numbered series and finishing you can see. Discover our limited editions.",
          imageUrl: STORY_IMAGE, ctaLabel: "Discover limited editions", ctaHref: "/collections/limited-edition",
        },
      ],
    });
  }

  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of admins) {
    await db.user.upsert({ where: { email }, create: { email, role: "ADMIN", name: "Store Admin" }, update: { role: "ADMIN" } });
  }
}

/** Local test accounts (one-click sign-in on /sign-in in dev). Never seeded into production. */
async function seedTestAccounts() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_LOGIN !== "1") return;
  for (const a of TEST_ACCOUNTS) {
    const user = await db.user.upsert({
      where: { email: a.email },
      create: { email: a.email, name: a.name, role: a.role, emailVerified: new Date(), phone: a.role === "CUSTOMER" ? "9876543210" : null },
      update: { role: a.role },
    });
    if (a.role === "CUSTOMER" && (await db.address.count({ where: { userId: user.id } })) === 0) {
      await db.address.create({
        data: {
          userId: user.id, label: "Home", fullName: a.name, phone: "9876543210", line1: "12, Marine Drive", line2: "Flat 4B",
          city: "Mumbai", state: "Maharashtra", pincode: "400020", isDefault: true,
        },
      });
    }
  }
  console.log(`Test accounts ready: ${TEST_ACCOUNTS.map((a) => a.email).join(", ")}`);
}

async function seedDemoCatalog() {
  const existing = await db.product.count({ where: { isDemo: true } });
  if (existing > 0) {
    console.log(`Demo catalogue already present (${existing} products) — skipping.`);
    return;
  }
  const settings = await db.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  const globalPct = Number(settings.globalDiscountPct);
  const rand = mulberry32(1891);

  const brandIds = new Map<string, string>();
  for (const b of BRANDS) {
    const brand = await db.brand.upsert({
      where: { slug: b.slug },
      create: { ...b, isDemo: true, heroImage: imageUrl({ n: 44 }) },
      update: {},
    });
    brandIds.set(b.slug, brand.id);
  }
  const collectionIds = new Map((await db.collection.findMany()).map((c) => [c.slug, c.id]));

  // Pre-compute blur placeholders in parallel.
  const urls = [...new Set(PRODUCTS.flatMap((p) => p.images.map(imageUrl)))];
  const blurs = new Map<string, string | null>();
  await Promise.all(urls.map(async (u) => blurs.set(u, await blurFor(u))));
  console.log(`Generated ${[...blurs.values()].filter(Boolean).length}/${urls.length} blur placeholders`);

  for (const [i, p] of PRODUCTS.entries()) {
    const brand = BRANDS.find((b) => b.slug === p.brand)!;
    const { pct, price } = priceFor(
      { mrp: p.mrp, discountOverridePct: p.override ?? null, excludeFromGlobalDiscount: Boolean(p.exclude) },
      globalPct,
    );
    const slug = `${p.modelName}-${p.ref}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const createdAt = new Date(Date.now() - p.daysAgo * 86_400_000);

    const product = await db.product.create({
      data: {
        brandId: brandIds.get(p.brand)!,
        modelName: p.modelName,
        referenceNumber: p.ref,
        slug,
        sku: `DEMO-${String(i + 1).padStart(3, "0")}`,
        description: p.description,
        status: "ACTIVE",
        featured: Boolean(p.featured),
        gender: p.gender,
        mrp: p.mrp,
        costPrice: p.cost,
        discountOverridePct: p.override ?? null,
        excludeFromGlobalDiscount: Boolean(p.exclude),
        sellingPrice: price,
        effectiveDiscountPct: pct,
        stock: p.stock,
        caseMaterial: p.caseMaterial,
        caseDiameterMm: p.dia,
        caseThicknessMm: p.thick,
        lugWidthMm: p.lug,
        dialColour: p.dial,
        strapMaterial: p.strap,
        strapType: strapTypeOf(p.strap) || null,
        watchType: /chrono/i.test(p.modelName) ? "Chronograph" : /dive|diver/i.test(p.modelName) || p.wr >= 200 ? "Diver" : /squelette|skeleton/i.test(p.modelName) ? "Skeleton" : "Analog",
        caseShape: /tank/i.test(p.modelName) ? "Rectangular" : "Round",
        strapColour: p.strapColour,
        movement: p.movement,
        calibre: p.calibre,
        powerReserveHours: p.power,
        waterResistanceM: p.wr,
        crystal: p.crystal,
        weightGrams: p.weight,
        warrantyMonths: p.warranty,
        boxAndPapers: true,
        seoTitle: `${brand.name} ${p.modelName} ${p.ref}`,
        seoDescription: p.description.slice(0, 155),
        externalRating: p.ext.rating,
        externalRatingCount: p.ext.count,
        externalRatingSource: "Sample Marketplace",
        viewCount: Math.round(rand() * 2000),
        soldCount: Math.round(rand() * 120),
        searchText: buildSearchText({ brand: brand.name, modelName: p.modelName, referenceNumber: p.ref, calibre: p.calibre, extra: p.collections }),
        isDemo: true,
        createdAt,
        images: {
          create: p.images.map((im, position) => {
            const url = imageUrl(im);
            return {
              url,
              alt: `${brand.name} ${p.modelName}${position === 0 ? "" : im.z ? " — dial detail" : " — alternate view"}`,
              width: 1200,
              height: 1500,
              position,
              blurDataUrl: blurs.get(url) ?? null,
            };
          }),
        },
        collections: { create: p.collections.map((slug, position) => ({ collectionId: collectionIds.get(slug)!, position })) },
      },
    });

    // Demo reviews: skewed to the attributed rating so pages look realistic.
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    for (let r = 0; r < p.reviews; r++) {
      const roll = rand();
      const target = p.ext.rating;
      const rating = roll < 0.06 ? 1 : roll < 0.12 ? 2 : roll < 0.12 + (5 - target) * 0.2 ? 3 + Math.round(rand()) : 5 - (rand() < (5 - target) ? 1 : 0);
      const pool = REVIEW_TEMPLATES[rating];
      const t = pool[Math.floor(rand() * pool.length)];
      const withPhoto = rating >= 4 && rand() < 0.2;
      dist[rating - 1]++;
      sum += rating;
      await db.review.create({
        data: {
          productId: product.id,
          authorName: REVIEWER_NAMES[(i * 7 + r) % REVIEWER_NAMES.length],
          rating,
          title: t.title,
          body: t.body,
          status: "APPROVED",
          verifiedPurchase: rand() < 0.85,
          helpfulCount: Math.floor(rand() * 40),
          isDemo: true,
          createdAt: new Date(createdAt.getTime() + Math.floor(rand() * Math.max(1, p.daysAgo) * 86_400_000)),
          storeReply: rating <= 2 ? "Thank you for the candid feedback — our client services team has reached out to make this right." : null,
          storeRepliedAt: rating <= 2 ? new Date() : null,
          images: withPhoto
            ? { create: [{ url: REVIEW_PHOTOS[Math.floor(rand() * REVIEW_PHOTOS.length)], width: 1200, height: 1200 }] }
            : undefined,
        },
      });
    }
    await db.product.update({
      where: { id: product.id },
      data: { ratingCount: p.reviews, ratingAvg: Math.round((sum / p.reviews) * 10) / 10, ratingDist: dist },
    });
    console.log(`  ✓ ${brand.name} — ${p.modelName}  ₹${price.toLocaleString("en-IN")} (${pct}% off), ${p.reviews} reviews`);
  }
}

async function main() {
  await seedSettings();
  await seedTestAccounts();
  if (process.env.SEED_DEMO !== "0") await seedDemoCatalog();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

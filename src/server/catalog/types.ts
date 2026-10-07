import type { Gender, Movement } from "@/generated/prisma/enums";

export type CardImage = { url: string; alt: string; width: number; height: number; blurDataUrl: string | null };

export type ProductCardData = {
  id: string;
  slug: string;
  brand: { name: string; slug: string };
  modelName: string;
  referenceNumber: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  images: CardImage[]; // first two, for hover swap
  ratingAvg: number;
  ratingCount: number;
  externalRating: number | null;
  externalRatingCount: number | null;
  externalRatingSource: string | null;
  gender: Gender;
  movement: Movement;
  caseDiameterMm: number;
  isDemo: boolean;
  featured: boolean;
};

export type SortKey = "relevance" | "recommended" | "newest" | "price_asc" | "price_desc" | "rating" | "popular";

export type ListingFilters = {
  q?: string;
  brands?: string[]; // slugs
  collection?: string; // slug
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[]; // "lt36" | "36-39" | "40-42" | "gt42"
  movements?: Movement[];
  straps?: string[];
  types?: string[];
  shapes?: string[];
  dials?: string[];
  gender?: Gender;
  inStock?: boolean;
};

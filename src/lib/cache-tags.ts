/** Cache tags — every admin mutation revalidates the relevant ones. */
export const TAGS = {
  settings: "settings",
  products: "products",
  product: (slug: string) => `product:${slug}`,
  brands: "brands",
  collections: "collections",
  reviews: (productId: string) => `reviews:${productId}`,
  home: "home",
  demo: "demo",
} as const;

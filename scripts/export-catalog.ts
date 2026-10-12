import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { exportCatalog, SNAPSHOT_FILE } from "../prisma/catalog-snapshot";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
exportCatalog(db)
  .then((n) => console.log(`Catalogue snapshot written to ${SNAPSHOT_FILE}: ${n.products} products, ${n.brands} brands, ${n.collections} collections, ${n.banners} banners. Commit it to share.`))
  .finally(() => db.$disconnect());

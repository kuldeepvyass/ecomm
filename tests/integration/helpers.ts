import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export function testDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("maison_test")) throw new Error(`Refusing to run integration tests against ${url}`);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function resetCatalog(db: PrismaClient) {
  await db.$executeRawUnsafe(`TRUNCATE "OrderItem","OrderStatusEvent","Payment","Refund","Order","CartItem","Cart","ProductCollection","ProductImage","Review","PriceChangeLog","Product","Brand","Counter","StoreSettings","User" RESTART IDENTITY CASCADE`);
}


-- AlterEnum


ALTER TYPE "Movement" ADD VALUE 'SOLAR';
ALTER TYPE "Movement" ADD VALUE 'KINETIC';
ALTER TYPE "Movement" ADD VALUE 'SMART';

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "origin" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "caseShape" TEXT,
ADD COLUMN     "functions" TEXT,
ADD COLUMN     "series" TEXT,
ADD COLUMN     "specialFeatures" TEXT,
ADD COLUMN     "strapType" TEXT,
ADD COLUMN     "watchType" TEXT;

-- CreateIndex
CREATE INDEX "Product_watchType_idx" ON "Product"("watchType");

-- CreateIndex
CREATE INDEX "Product_caseShape_idx" ON "Product"("caseShape");

-- CreateIndex
CREATE INDEX "Product_strapType_idx" ON "Product"("strapType");


-- Backfill classification for existing products
UPDATE "Product" SET "strapType" = CASE
  WHEN "strapMaterial" ILIKE '%mesh%' OR "strapMaterial" ILIKE '%milanese%' THEN 'Mesh'
  WHEN "strapMaterial" ILIKE '%leather%' OR "strapMaterial" ILIKE '%alligator%' OR "strapMaterial" ILIKE '%suede%' OR "strapMaterial" ILIKE '%calf%' THEN 'Leather'
  WHEN "strapMaterial" ILIKE '%rubber%' OR "strapMaterial" ILIKE '%silicone%' OR "strapMaterial" ILIKE '%resin%' THEN 'Rubber / silicone'
  WHEN "strapMaterial" ILIKE '%nylon%' OR "strapMaterial" ILIKE '%fabric%' OR "strapMaterial" ILIKE '%nato%' OR "strapMaterial" ILIKE '%canvas%' THEN 'Fabric'
  WHEN "strapMaterial" ILIKE '%ceramic%' THEN 'Ceramic'
  WHEN "strapMaterial" ILIKE '%bracelet%' OR "strapMaterial" ILIKE '%steel%' OR "strapMaterial" ILIKE '%metal%' OR "strapMaterial" ILIKE '%gold%' OR "strapMaterial" ILIKE '%titanium%' THEN 'Metal bracelet'
  ELSE 'Other' END
WHERE "strapType" IS NULL;

UPDATE "Product" SET "watchType" = CASE
  WHEN "modelName" ILIKE '%chrono%' THEN 'Chronograph'
  WHEN "modelName" ILIKE '%diver%' OR "modelName" ILIKE '%dive%' OR "waterResistanceM" >= 200 THEN 'Diver'
  WHEN "modelName" ILIKE '%squelette%' OR "modelName" ILIKE '%skeleton%' THEN 'Skeleton'
  ELSE 'Analog' END
WHERE "watchType" IS NULL;

UPDATE "Product" SET "caseShape" = CASE WHEN "modelName" ILIKE '%tank%' THEN 'Rectangular' ELSE 'Round' END WHERE "caseShape" IS NULL;

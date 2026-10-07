-- "Recommended" sort: premium analog first. Computed by Postgres so imports, edits and the featured toggle keep it current.
ALTER TABLE "Product" ADD COLUMN "rankScore" INTEGER GENERATED ALWAYS AS (
    (CASE WHEN "watchType" = 'Smartwatch' OR "movement" = 'SMART' THEN 0 ELSE 100 END)
  + (CASE WHEN "featured" THEN 40 ELSE 0 END)
  + (CASE WHEN "movement" IN ('AUTOMATIC', 'MANUAL') THEN 20 ELSE 0 END)
  + (CASE WHEN "externalRating" >= 4.5 THEN 5 ELSE 0 END)
) STORED;

CREATE INDEX "Product_rankScore_idx" ON "Product"("status", "deletedAt", "rankScore" DESC, "sellingPrice" DESC, "id" DESC);

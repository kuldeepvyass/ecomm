-- Customer bank details for manual refunds (bank transfer avoids the UPI daily limit).
ALTER TABLE "Refund"
  ADD COLUMN "accountHolder" TEXT,
  ADD COLUMN "accountNumber" TEXT,
  ADD COLUMN "accountLast4" VARCHAR(4),
  ADD COLUMN "ifsc" VARCHAR(11),
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankBranch" TEXT,
  ADD COLUMN "bankDetailsAt" TIMESTAMP(3),
  ADD COLUMN "processedAt" TIMESTAMP(3);

-- Refunds already sent before this change count as processed when they were last updated.
UPDATE "Refund" SET "processedAt" = "updatedAt" WHERE "status" = 'PROCESSED' AND "processedAt" IS NULL;

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_SUBMITTED';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('UPI', 'COD');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ((CASE WHEN "paymentMethod"::text = 'RAZORPAY' THEN 'UPI' ELSE "paymentMethod"::text END)::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED', 'REFUNDED', 'PARTIALLY_REFUNDED');
ALTER TABLE "public"."Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ((CASE "status"::text WHEN 'CAPTURED' THEN 'CONFIRMED' WHEN 'REFUNDED' THEN 'REFUNDED' WHEN 'PARTIALLY_REFUNDED' THEN 'PARTIALLY_REFUNDED' WHEN 'CREATED' THEN 'SUBMITTED' WHEN 'AUTHORIZED' THEN 'SUBMITTED' ELSE 'REJECTED' END)::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- DropIndex
DROP INDEX "Payment_razorpayOrderId_key";

-- DropIndex
DROP INDEX "Payment_razorpayPaymentId_key";

-- DropIndex
DROP INDEX "Refund_razorpayRefundId_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentDueAt" TIMESTAMP(3);

-- Preserve legacy gateway references as placeholder UTRs before the column becomes required
ALTER TABLE "Payment" ADD COLUMN "utr" TEXT;
UPDATE "Payment" SET "utr" = COALESCE("razorpayPaymentId", 'LEGACY-' || "id");
ALTER TABLE "Payment" ALTER COLUMN "utr" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "errorCode",
DROP COLUMN "errorDescription",
DROP COLUMN "method",
DROP COLUMN "razorpayOrderId",
DROP COLUMN "razorpayPaymentId",
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "payerVpa" TEXT,
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "screenshotPublicId" TEXT,
ADD COLUMN     "screenshotUrl" TEXT,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE "Refund" RENAME COLUMN "razorpayRefundId" TO "reference";

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "paymentWindowMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "upiPayeeName" TEXT,
ADD COLUMN     "upiVpa" TEXT;

-- DropTable
DROP TABLE "WebhookEvent";

-- CreateIndex
CREATE INDEX "Order_status_paymentDueAt_idx" ON "Order"("status", "paymentDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_utr_key" ON "Payment"("utr");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- UTRs are 12 digits; legacy placeholders are exempt.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_utr_format" CHECK ("utr" ~ '^[0-9]{12}$' OR "utr" LIKE 'LEGACY-%' OR "utr" LIKE 'pay_%');
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_payment_window" CHECK ("paymentWindowMinutes" BETWEEN 5 AND 1440);

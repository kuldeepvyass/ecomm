-- Cash on Delivery removed: UPI is the only payment method.
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('UPI');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

ALTER TABLE "Order" DROP COLUMN "codFee";
ALTER TABLE "StoreSettings" DROP COLUMN "codEnabled", DROP COLUMN "codFee", DROP COLUMN "codMaxOrderValue";
ALTER TABLE "ShippingZone" DROP COLUMN "codAvailable";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryOption" TEXT NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "expressShippingFee" INTEGER;

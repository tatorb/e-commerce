-- Stock del producto: lo heredan sus publicaciones y lo descuentan las ventas del canal.
-- CreateEnum
CREATE TYPE "StockMoveKind" AS ENUM ('INITIAL', 'SALE', 'CANCEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COUNTED', 'RETURNED', 'KEPT', 'SKIPPED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stockReview" TEXT,
ADD COLUMN     "stockSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "salesCheckedAt" TIMESTAMP(3),
ADD COLUMN     "salesError" TEXT,
ADD COLUMN     "salesSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "product_stock" (
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_stock_pkey" PRIMARY KEY ("productId","key")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "StockMoveKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "publicationId" TEXT,
    "saleId" TEXT,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sales" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "channel_sales_status_checkedAt_idx" ON "channel_sales"("status", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "channel_sales_storeId_orderId_key" ON "channel_sales"("storeId", "orderId");

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "channel_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sales" ADD CONSTRAINT "channel_sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;


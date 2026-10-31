-- CreateEnum
CREATE TYPE "SaleState" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleShipState" AS ENUM ('NONE', 'PENDING', 'TO_SHIP', 'SHIPPED', 'DELIVERED', 'NOT_DELIVERED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "packId" TEXT,
    "state" "SaleState" NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "itemsAmount" DECIMAL(14,2) NOT NULL,
    "listAmount" DECIMAL(14,2),
    "fee" DECIMAL(14,2),
    "paidAmount" DECIMAL(14,2),
    "buyerId" TEXT,
    "buyerNickname" TEXT,
    "buyerName" TEXT,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "payments" JSONB NOT NULL DEFAULT '[]',
    "paymentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "netReceived" DECIMAL(14,2),
    "releaseAt" TIMESTAMP(3),
    "released" BOOLEAN,
    "refunded" DECIMAL(14,2),
    "shipmentId" TEXT,
    "shipState" "SaleShipState" NOT NULL DEFAULT 'NONE',
    "shipDetail" TEXT,
    "shipKind" TEXT,
    "shipKindLabel" TEXT,
    "tracking" TEXT,
    "dispatchBy" TIMESTAMP(3),
    "estimatedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "shipDelayed" BOOLEAN NOT NULL DEFAULT false,
    "shippingCost" DECIMAL(14,2),
    "buyerShipping" DECIMAL(14,2),
    "claim" BOOLEAN NOT NULL DEFAULT false,
    "cancelBy" TEXT,
    "cancelReason" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "detailsAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_readers" (
    "storeId" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "historyFrom" TIMESTAMP(3),
    "historyCursor" TIMESTAMP(3),
    "historyOffset" INTEGER NOT NULL DEFAULT 0,
    "historyUntil" TIMESTAMP(3),
    "historyDoneAt" TIMESTAMP(3),
    "updatedUntil" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "lastError" TEXT,
    "noticeAt" TIMESTAMP(3),

    CONSTRAINT "sale_readers_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE INDEX "sales_storeId_orderedAt_idx" ON "sales"("storeId", "orderedAt");

-- CreateIndex
CREATE INDEX "sales_storeId_shipState_idx" ON "sales"("storeId", "shipState");

-- CreateIndex
CREATE INDEX "sales_shipmentId_idx" ON "sales"("shipmentId");

-- CreateIndex
CREATE INDEX "sales_detailsAt_idx" ON "sales"("detailsAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_storeId_orderId_key" ON "sales"("storeId", "orderId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_readers" ADD CONSTRAINT "sale_readers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las sucursales de la cuenta, el stock de cada una y si Flex sigue al stock.
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "flex" BOOLEAN NOT NULL DEFAULT false,
    "main" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_accountId_name_key" ON "branches"("accountId", "name");
ALTER TABLE "branches" ADD CONSTRAINT "branches_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "branch_stock" (
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "branch_stock_pkey" PRIMARY KEY ("productId","key","branchId")
);
CREATE INDEX "branch_stock_branchId_idx" ON "branch_stock"("branchId");
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD COLUMN "branches" JSONB;
ALTER TABLE "publications" ADD COLUMN "flexFollowsStock" BOOLEAN NOT NULL DEFAULT true;

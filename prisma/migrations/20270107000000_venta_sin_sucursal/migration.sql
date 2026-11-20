-- Las ventas que no son Flex en una cuenta con sucursales: falta decir de qué sucursal salieron.
ALTER TABLE "stock_movements" ADD COLUMN "branchPending" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "stock_movements_productId_branchPending_idx" ON "stock_movements"("productId", "branchPending");

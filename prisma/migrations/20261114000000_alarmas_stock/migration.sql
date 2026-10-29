-- Mostrar más de 5 en los canales aunque haya menos, con alarmas para reponer.
ALTER TABLE "products" ADD COLUMN "showMore" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "product_stock" ADD COLUMN "lowAt" TIMESTAMP(3);
ALTER TABLE "product_stock" ADD COLUMN "outSince" TIMESTAMP(3);
ALTER TABLE "product_stock" ADD COLUMN "remindedAt" TIMESTAMP(3);
ALTER TABLE "product_stock" ADD COLUMN "cutAt" TIMESTAMP(3);
CREATE INDEX "product_stock_outSince_idx" ON "product_stock"("outSince");

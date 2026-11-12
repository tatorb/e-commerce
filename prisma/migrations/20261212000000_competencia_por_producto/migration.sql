-- La competencia puede ser de cada publicación o del producto, según el tipo de producto.
-- CreateEnum
CREATE TYPE "CompetitorScope" AS ENUM ('PUBLICATION', 'PRODUCT');

-- Cada tipo arranca en "Por publicación": no cambia nada hasta que se active.
ALTER TABLE "product_options" ADD COLUMN "competitorScope" "CompetitorScope" NOT NULL DEFAULT 'PUBLICATION';

-- Una fila de competencia es de una publicación o de un producto, nunca de los dos.
ALTER TABLE "competitor_listings" ALTER COLUMN "publicationId" DROP NOT NULL;
ALTER TABLE "competitor_listings" ADD COLUMN "productId" TEXT;
ALTER TABLE "competitor_listings" ADD CONSTRAINT "competitor_listings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "competitor_listings_productId_idx" ON "competitor_listings"("productId");
ALTER TABLE "competitor_listings" ADD CONSTRAINT "competitor_listings_one_owner" CHECK (("publicationId" IS NULL) <> ("productId" IS NULL));

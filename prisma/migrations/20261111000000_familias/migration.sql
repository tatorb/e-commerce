-- Familias: cuando el canal guarda cada medida como una publicación aparte y
-- las agrupa, la app tiene una publicación por medida, agrupadas en su familia.
CREATE TABLE "listing_families" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channelFamilyId" TEXT,
    "leadId" TEXT,
    "samePrice" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_families_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "listing_families_leadId_key" ON "listing_families"("leadId");
CREATE INDEX "listing_families_productId_idx" ON "listing_families"("productId");
CREATE UNIQUE INDEX "listing_families_storeId_channelFamilyId_key" ON "listing_families"("storeId", "channelFamilyId");
ALTER TABLE "listing_families" ADD CONSTRAINT "listing_families_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_families" ADD CONSTRAINT "listing_families_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada publicación: su familia, la medida que vende y si tiene su propio precio.
ALTER TABLE "publications" ADD COLUMN "familyId" TEXT;
ALTER TABLE "publications" ADD COLUMN "variantKey" TEXT;
ALTER TABLE "publications" ADD COLUMN "ownPrice" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "publications_familyId_idx" ON "publications"("familyId");
ALTER TABLE "publications" ADD CONSTRAINT "publications_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "listing_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "listing_families" ADD CONSTRAINT "listing_families_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

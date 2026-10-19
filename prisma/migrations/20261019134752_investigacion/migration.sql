-- CreateEnum
CREATE TYPE "ProductFileKind" AS ENUM ('IMAGE', 'PDF');

-- CreateEnum
CREATE TYPE "InsightKind" AS ENUM ('PAIN', 'OBJECTION');

-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "channelCategory" TEXT;

-- CreateTable
CREATE TABLE "product_research" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "manufacturerSite" TEXT,
    "manufacturerProductUrl" TEXT,
    "manufacturerText" TEXT,
    "clarifications" TEXT,
    "ownQuestions" TEXT,
    "competitorQuestions" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_files" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ProductFileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_insights" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "InsightKind" NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_research_productId_key" ON "product_research"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_files_url_key" ON "product_files"("url");

-- CreateIndex
CREATE INDEX "product_files_productId_idx" ON "product_files"("productId");

-- CreateIndex
CREATE INDEX "buyer_insights_productId_kind_position_idx" ON "buyer_insights"("productId", "kind", "position");

-- AddForeignKey
ALTER TABLE "product_research" ADD CONSTRAINT "product_research_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_research" ADD CONSTRAINT "product_research_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_insights" ADD CONSTRAINT "buyer_insights_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

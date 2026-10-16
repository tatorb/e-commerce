-- CreateEnum
CREATE TYPE "ImportUpdateMode" AS ENUM ('FILL_EMPTY', 'REPLACE');

-- AlterTable
ALTER TABLE "import_runs" ADD COLUMN     "fieldsChanged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publicationsUpdated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updateMode" "ImportUpdateMode" NOT NULL DEFAULT 'FILL_EMPTY';

-- CreateTable
CREATE TABLE "import_changes" (
    "id" SERIAL NOT NULL,
    "importRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "publicationId" TEXT,
    "field" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_changes_importRunId_idx" ON "import_changes"("importRunId");

-- CreateIndex
CREATE INDEX "import_changes_productId_idx" ON "import_changes"("productId");

-- AddForeignKey
ALTER TABLE "import_changes" ADD CONSTRAINT "import_changes_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_changes" ADD CONSTRAINT "import_changes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_changes" ADD CONSTRAINT "import_changes_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED', 'UNDONE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "importRunId" TEXT;

-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "importRunId" TEXT;

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "takenAt" DATE NOT NULL,
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "importRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '[]',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "mappingId" TEXT,
    "userId" TEXT,
    "fileName" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "dataDate" DATE NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'RUNNING',
    "rowsTotal" INTEGER NOT NULL,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "productsCreated" INTEGER NOT NULL DEFAULT 0,
    "publicationsCreated" INTEGER NOT NULL DEFAULT 0,
    "publicationsLinked" INTEGER NOT NULL DEFAULT 0,
    "publicationsExisting" INTEGER NOT NULL DEFAULT 0,
    "measurementsSaved" INTEGER NOT NULL DEFAULT 0,
    "rowsWithErrors" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurements_importRunId_idx" ON "measurements"("importRunId");

-- CreateIndex
CREATE UNIQUE INDEX "measurements_publicationId_takenAt_key" ON "measurements"("publicationId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "import_mappings_accountId_name_key" ON "import_mappings"("accountId", "name");

-- CreateIndex
CREATE INDEX "import_runs_accountId_startedAt_idx" ON "import_runs"("accountId", "startedAt");

-- CreateIndex
CREATE INDEX "products_importRunId_idx" ON "products"("importRunId");

-- CreateIndex
CREATE INDEX "publications_importRunId_idx" ON "publications"("importRunId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "import_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

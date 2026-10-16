-- CreateEnum
CREATE TYPE "PipelineStep" AS ENUM ('INFO', 'TITLE', 'IMAGES', 'VIDEOS', 'MEDIA', 'DESCRIPTION', 'PUBLISH');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('UNTOUCHED', 'IN_PIPELINE', 'CORRECTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "PipelineExit" AS ENUM ('ADVANCED', 'BACK', 'REMOVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PipelineRemoval" AS ENUM ('NOT_WORTH', 'LATER', 'DUPLICATE', 'PAUSE');

-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "pipelineRemoval" "PipelineRemoval",
ADD COLUMN     "pipelineStatus" "PipelineStatus" NOT NULL DEFAULT 'UNTOUCHED',
ADD COLUMN     "pipelineStep" "PipelineStep",
ADD COLUMN     "titleLockedManual" BOOLEAN;

-- CreateTable
CREATE TABLE "pipeline_movements" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "step" "PipelineStep" NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "exitedAt" TIMESTAMP(3),
    "exitKind" "PipelineExit",
    "removal" "PipelineRemoval",
    "exitedById" TEXT,

    CONSTRAINT "pipeline_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_movements_publicationId_enteredAt_idx" ON "pipeline_movements"("publicationId", "enteredAt");

-- CreateIndex
CREATE INDEX "publications_pipelineStatus_idx" ON "publications"("pipelineStatus");

-- AddForeignKey
ALTER TABLE "pipeline_movements" ADD CONSTRAINT "pipeline_movements_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_movements" ADD CONSTRAINT "pipeline_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_movements" ADD CONSTRAINT "pipeline_movements_exitedById_fkey" FOREIGN KEY ("exitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unificación de la etapa: las publicaciones que el recorrido de la propuesta
-- con IA dejó aplicadas en el canal quedan como corregidas. Las demás empiezan
-- sin tocar.
UPDATE "publications" SET "pipelineStatus" = 'CORRECTED' WHERE "stage" IN ('APPLIED', 'MEASURED');

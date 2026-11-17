-- El editor de videos: las ediciones de cada video, cuándo puede editar la Mac
-- y la copia liviana que la cámara graba al lado del video. Solo agrega.
-- CreateEnum
CREATE TYPE "VideoEditStatus" AS ENUM ('QUEUED', 'PROCESSING', 'REVIEW', 'APPROVED', 'DISCARDED', 'FAILED');

-- AlterTable
ALTER TABLE "product_videos" ADD COLUMN     "lightFileId" TEXT,
ADD COLUMN     "lightSize" BIGINT;

-- CreateTable
CREATE TABLE "video_edits" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "VideoEditStatus" NOT NULL DEFAULT 'QUEUED',
    "openFor" TEXT,
    "targetSeconds" INTEGER NOT NULL DEFAULT 45,
    "note" TEXT,
    "requested" JSONB,
    "plan" JSONB,
    "measures" JSONB,
    "proposal" JSONB,
    "clipId" TEXT,
    "aiUsage" JSONB,
    "seconds" INTEGER,
    "workerId" TEXT,
    "lease" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "askedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_editor_settings" (
    "id" TEXT NOT NULL DEFAULT 'estudio',
    "mode" TEXT NOT NULL DEFAULT 'OFF',
    "fromMinute" INTEGER NOT NULL DEFAULT 1320,
    "toMinute" INTEGER NOT NULL DEFAULT 420,
    "pluggedOnly" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_editor_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_edits_openFor_key" ON "video_edits"("openFor");

-- CreateIndex
CREATE UNIQUE INDEX "video_edits_clipId_key" ON "video_edits"("clipId");

-- CreateIndex
CREATE INDEX "video_edits_videoId_createdAt_idx" ON "video_edits"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "video_edits_status_createdAt_idx" ON "video_edits"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "video_edits" ADD CONSTRAINT "video_edits_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "product_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_edits" ADD CONSTRAINT "video_edits_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "product_videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_edits" ADD CONSTRAINT "video_edits_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "image_workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_edits" ADD CONSTRAINT "video_edits_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_edits" ADD CONSTRAINT "video_edits_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


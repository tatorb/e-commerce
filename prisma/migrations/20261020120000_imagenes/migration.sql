-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('UPLOAD', 'CHANNEL');

-- CreateEnum
CREATE TYPE "PhotoRunStatus" AS ENUM ('QUEUED', 'PROCESSING', 'REVIEW', 'APPROVED', 'SKIPPED', 'FAILED', 'REPLACED');

-- CreateTable
CREATE TABLE "image_workers" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "info" JSONB,

    CONSTRAINT "image_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_settings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_edits" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "PhotoSource" NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "originalType" TEXT NOT NULL,
    "originalSize" INTEGER NOT NULL,
    "channelUrl" TEXT,
    "previewUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "camera" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_step_runs" (
    "id" TEXT NOT NULL,
    "editId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "status" "PhotoRunStatus" NOT NULL DEFAULT 'QUEUED',
    "openFor" TEXT,
    "requested" JSONB,
    "settings" JSONB NOT NULL,
    "proposal" JSONB,
    "values" JSONB,
    "measures" JSONB,
    "params" JSONB,
    "note" TEXT,
    "notApplicable" TEXT,
    "previewUrl" TEXT,
    "maskUrl" TEXT,
    "pngUrl" TEXT,
    "jpgUrl" TEXT,
    "aiUsage" JSONB,
    "seconds" DOUBLE PRECISION,
    "lease" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "workerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_workers_keyHash_key" ON "image_workers"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "photo_settings_accountId_key" ON "photo_settings"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "photo_edits_originalUrl_key" ON "photo_edits"("originalUrl");

-- CreateIndex
CREATE INDEX "photo_edits_productId_position_idx" ON "photo_edits"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "photo_step_runs_openFor_key" ON "photo_step_runs"("openFor");

-- CreateIndex
CREATE INDEX "photo_step_runs_status_createdAt_idx" ON "photo_step_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "photo_step_runs_editId_step_idx" ON "photo_step_runs"("editId", "step");

-- AddForeignKey
ALTER TABLE "image_workers" ADD CONSTRAINT "image_workers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_settings" ADD CONSTRAINT "photo_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_settings" ADD CONSTRAINT "photo_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_edits" ADD CONSTRAINT "photo_edits_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_edits" ADD CONSTRAINT "photo_edits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_step_runs" ADD CONSTRAINT "photo_step_runs_editId_fkey" FOREIGN KEY ("editId") REFERENCES "photo_edits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_step_runs" ADD CONSTRAINT "photo_step_runs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "image_workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_step_runs" ADD CONSTRAINT "photo_step_runs_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "VideoOrigin" AS ENUM ('APP', 'DRIVE');

-- CreateTable
CREATE TABLE "drive_connections" (
    "id" TEXT NOT NULL DEFAULT 'estudio',
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "clientSecretHint" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "email" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "connectedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "lastRefreshAt" TIMESTAMP(3),
    "lastError" TEXT,
    "pendingState" TEXT,
    "pendingVerifier" TEXT,
    "pendingUntil" TIMESTAMP(3),
    "pendingById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_folders" (
    "key" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_folders_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "product_videos" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "measuredBy" TEXT,
    "webViewLink" TEXT,
    "origin" "VideoOrigin" NOT NULL,
    "uploadedById" TEXT,
    "driveCreatedAt" TIMESTAMP(3),
    "goneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_clips" (
    "publicationId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "chosenById" TEXT,
    "chosenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "uploadedById" TEXT,

    CONSTRAINT "publication_clips_pkey" PRIMARY KEY ("publicationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "drive_connections_pendingState_key" ON "drive_connections"("pendingState");

-- CreateIndex
CREATE UNIQUE INDEX "product_videos_driveFileId_key" ON "product_videos"("driveFileId");

-- CreateIndex
CREATE INDEX "product_videos_productId_idx" ON "product_videos"("productId");

-- CreateIndex
CREATE INDEX "publication_clips_videoId_idx" ON "publication_clips"("videoId");

-- AddForeignKey
ALTER TABLE "drive_connections" ADD CONSTRAINT "drive_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_connections" ADD CONSTRAINT "drive_connections_pendingById_fkey" FOREIGN KEY ("pendingById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_clips" ADD CONSTRAINT "publication_clips_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_clips" ADD CONSTRAINT "publication_clips_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "product_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_clips" ADD CONSTRAINT "publication_clips_chosenById_fkey" FOREIGN KEY ("chosenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_clips" ADD CONSTRAINT "publication_clips_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


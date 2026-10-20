-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncChangeKind" AS ENUM ('TAKEN', 'CHOSE_CHANNEL', 'CHOSE_APP');

-- CreateTable
CREATE TABLE "channel_copies" (
    "publicationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "channelUpdatedAt" TIMESTAMP(3),
    "descriptionReadAt" TIMESTAMP(3),
    "missingSince" TIMESTAMP(3),
    "title" TEXT,
    "description" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "price" DECIMAL(14,2),
    "status" "ChannelStatus" NOT NULL,
    "url" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "hasVideo" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB NOT NULL DEFAULT '{}',
    "fingerprints" JSONB NOT NULL DEFAULT '{}',
    "agreed" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_copies_pkey" PRIMARY KEY ("publicationId")
);

-- CreateTable
CREATE TABLE "channel_syncs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "userId" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "ids" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "read" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "toChoose" INTEGER,
    "newInChannel" INTEGER,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "channel_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sync_changes" (
    "id" SERIAL NOT NULL,
    "syncId" TEXT,
    "publicationId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "kind" "SyncChangeKind" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sync_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_syncs_storeId_startedAt_idx" ON "channel_syncs"("storeId", "startedAt");

-- CreateIndex
CREATE INDEX "channel_sync_changes_publicationId_createdAt_idx" ON "channel_sync_changes"("publicationId", "createdAt");

-- CreateIndex
CREATE INDEX "channel_sync_changes_syncId_idx" ON "channel_sync_changes"("syncId");

-- AddForeignKey
ALTER TABLE "channel_copies" ADD CONSTRAINT "channel_copies_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_syncs" ADD CONSTRAINT "channel_syncs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_syncs" ADD CONSTRAINT "channel_syncs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_changes" ADD CONSTRAINT "channel_sync_changes_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "channel_syncs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_changes" ADD CONSTRAINT "channel_sync_changes_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_changes" ADD CONSTRAINT "channel_sync_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Una sola pasada en curso por tienda.
CREATE UNIQUE INDEX "channel_syncs_one_running" ON "channel_syncs"("storeId") WHERE "status" = 'RUNNING';

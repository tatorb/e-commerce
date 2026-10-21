-- AlterEnum
ALTER TYPE "SyncChangeKind" ADD VALUE 'REJECTED';
ALTER TYPE "SyncChangeKind" ADD VALUE 'CREATE_FAILED';

-- AlterTable
ALTER TABLE "channel_sync_changes" ADD COLUMN     "message" TEXT;

-- CreateIndex
CREATE INDEX "channel_sync_changes_createdAt_idx" ON "channel_sync_changes"("createdAt");

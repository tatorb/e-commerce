-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SyncChangeKind" ADD VALUE 'SENT';
ALTER TYPE "SyncChangeKind" ADD VALUE 'DISCARDED';

-- AlterTable
ALTER TABLE "channel_copies" ADD COLUMN     "rejections" JSONB NOT NULL DEFAULT '{}';


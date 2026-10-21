-- AlterEnum
ALTER TYPE "SyncChangeKind" ADD VALUE 'CREATED';

-- AlterTable
ALTER TABLE "channel_copies" ADD COLUMN     "photoIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "photoOrigins" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "media" JSONB;


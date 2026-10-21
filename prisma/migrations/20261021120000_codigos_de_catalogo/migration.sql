-- AlterTable
ALTER TABLE "channel_copies" ADD COLUMN     "attributeIds" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "categoryId" TEXT;


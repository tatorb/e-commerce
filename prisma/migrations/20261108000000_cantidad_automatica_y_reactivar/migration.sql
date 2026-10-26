
-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "followsStock" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "autoKey" TEXT;

-- CreateIndex
CREATE INDEX "tasks_autoKey_idx" ON "tasks"("autoKey");


-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "review" JSONB;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

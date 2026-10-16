-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'ACTIVE',
    "summary" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "baseline" JSONB NOT NULL,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT NOT NULL,
    "usage" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_publicationId_status_idx" ON "proposals"("publicationId", "status");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

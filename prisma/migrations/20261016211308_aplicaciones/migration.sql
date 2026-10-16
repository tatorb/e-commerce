-- CreateTable
CREATE TABLE "channel_applications" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "proposalId" TEXT,
    "method" "ApplyMethod" NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_applications_publicationId_appliedAt_idx" ON "channel_applications"("publicationId", "appliedAt");

-- AddForeignKey
ALTER TABLE "channel_applications" ADD CONSTRAINT "channel_applications_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_applications" ADD CONSTRAINT "channel_applications_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_applications" ADD CONSTRAINT "channel_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

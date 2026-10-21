-- CreateTable
CREATE TABLE "description_drafts" (
    "publicationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "toConfirm" JSONB NOT NULL DEFAULT '[]',
    "usedData" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT NOT NULL,
    "usage" JSONB NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "description_drafts_pkey" PRIMARY KEY ("publicationId")
);

-- CreateTable
CREATE TABLE "description_settings" (
    "accountId" TEXT NOT NULL,
    "header" TEXT,
    "footer" TEXT,
    "guidelines" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "description_settings_pkey" PRIMARY KEY ("accountId")
);

-- AddForeignKey
ALTER TABLE "description_drafts" ADD CONSTRAINT "description_drafts_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "description_drafts" ADD CONSTRAINT "description_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "description_settings" ADD CONSTRAINT "description_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


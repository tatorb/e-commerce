-- CreateEnum
CREATE TYPE "TitleLockDecision" AS ENUM ('KEEP', 'TRY_IN_COPY');

-- CreateEnum
CREATE TYPE "TitleOutcome" AS ENUM ('KEPT', 'WRITTEN', 'COPY');

-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "compatibilities" ADD COLUMN     "displacement" TEXT,
ADD COLUMN     "fuel" TEXT;

-- CreateTable
CREATE TABLE "competitor_listings" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "soldQuantity" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "title_rule_sets" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "maxLength" INTEGER,
    "forbiddenChars" TEXT NOT NULL DEFAULT '',
    "forbiddenWords" JSONB NOT NULL DEFAULT '[]',
    "structures" JSONB NOT NULL DEFAULT '[]',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "title_works" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "lockDecision" "TitleLockDecision",
    "lockDecidedAt" TIMESTAMP(3),
    "lockDecidedById" TEXT,
    "seeds" JSONB,
    "words" JSONB NOT NULL DEFAULT '{}',
    "mainSearches" JSONB NOT NULL DEFAULT '[]',
    "proposals" JSONB NOT NULL DEFAULT '[]',
    "proposalsAt" TIMESTAMP(3),
    "proposalUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "title_approvals" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "outcome" "TitleOutcome" NOT NULL,
    "before" TEXT,
    "title" TEXT,
    "aiTitle" TEXT,
    "aiProposals" JSONB NOT NULL DEFAULT '[]',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "title_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_suggestions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "source" "CaptureSource" NOT NULL,
    "publicationId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_positions" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "page" INTEGER,
    "position" INTEGER,
    "pagesChecked" INTEGER NOT NULL DEFAULT 3,
    "source" "CaptureSource" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_probes" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "check" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "detail" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_probes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitor_listings_publicationId_idx" ON "competitor_listings"("publicationId");

-- CreateIndex
CREATE UNIQUE INDEX "title_rule_sets_accountId_channelId_key" ON "title_rule_sets"("accountId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "title_works_publicationId_key" ON "title_works"("publicationId");

-- CreateIndex
CREATE INDEX "title_approvals_publicationId_createdAt_idx" ON "title_approvals"("publicationId", "createdAt");

-- CreateIndex
CREATE INDEX "search_suggestions_accountId_channelId_seed_idx" ON "search_suggestions"("accountId", "channelId", "seed");

-- CreateIndex
CREATE INDEX "search_positions_publicationId_checkedAt_idx" ON "search_positions"("publicationId", "checkedAt");

-- CreateIndex
CREATE INDEX "channel_probes_channelId_check_checkedAt_idx" ON "channel_probes"("channelId", "check", "checkedAt");

-- AddForeignKey
ALTER TABLE "competitor_listings" ADD CONSTRAINT "competitor_listings_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_rule_sets" ADD CONSTRAINT "title_rule_sets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_rule_sets" ADD CONSTRAINT "title_rule_sets_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_rule_sets" ADD CONSTRAINT "title_rule_sets_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_works" ADD CONSTRAINT "title_works_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_works" ADD CONSTRAINT "title_works_lockDecidedById_fkey" FOREIGN KEY ("lockDecidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_approvals" ADD CONSTRAINT "title_approvals_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_approvals" ADD CONSTRAINT "title_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_suggestions" ADD CONSTRAINT "search_suggestions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_suggestions" ADD CONSTRAINT "search_suggestions_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_positions" ADD CONSTRAINT "search_positions_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_probes" ADD CONSTRAINT "channel_probes_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cilindrada y combustible a partir del motor que ya está cargado, con la
-- misma regla que src/domain/engine.ts: "1.9 Diesel" da 1.9 y Diesel.
UPDATE "compatibilities"
SET "displacement" = replace(substring("engine" from '(?:^|[^0-9.,])([0-9][.,][0-9])(?:$|[^0-9.,])'), ',', '.')
WHERE "engine" IS NOT NULL;

UPDATE "compatibilities" SET "fuel" = 'Diesel'
WHERE "engine" ~* '\m(diesel|td|tdi|tdci|hdi|jtd|jtdm|dci|crdi|cdi|d4d|tddi)\M';
UPDATE "compatibilities" SET "fuel" = 'GNC' WHERE "fuel" IS NULL AND "engine" ~* '\mgnc\M';
UPDATE "compatibilities" SET "fuel" = 'Nafta' WHERE "fuel" IS NULL AND "engine" ~* '\mnafta\M';

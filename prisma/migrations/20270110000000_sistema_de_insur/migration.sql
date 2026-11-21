-- El sistema de Insur: los ajustes de la cuenta, el cruce de cada artículo con
-- una medida de la app, los datos de su ficha y las corridas de la extensión.
CREATE TYPE "InsurLinkStatus" AS ENUM ('AUTO', 'CONFIRMED', 'PENDING', 'DOUBTFUL', 'IGNORED');

CREATE TABLE "insur_settings" (
    "accountId" TEXT NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "fichaEveryDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insur_settings_pkey" PRIMARY KEY ("accountId")
);
ALTER TABLE "insur_settings" ADD CONSTRAINT "insur_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "insur_article_links" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "insurId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "measureName" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "detail" TEXT,
    "bocas" TEXT,
    "productId" TEXT,
    "key" TEXT,
    "status" "InsurLinkStatus" NOT NULL,
    "reason" TEXT,
    "candidates" JSONB NOT NULL DEFAULT '[]',
    "stockCordoba" INTEGER,
    "stockSantaFe" INTEGER,
    "seenAt" TIMESTAMP(3),
    "missingSince" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insur_article_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insur_article_links_accountId_insurId_key" ON "insur_article_links"("accountId", "insurId");
CREATE INDEX "insur_article_links_accountId_status_idx" ON "insur_article_links"("accountId", "status");
CREATE INDEX "insur_article_links_productId_idx" ON "insur_article_links"("productId");
ALTER TABLE "insur_article_links" ADD CONSTRAINT "insur_article_links_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insur_article_links" ADD CONSTRAINT "insur_article_links_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "insur_article_data" (
    "linkId" TEXT NOT NULL,
    "precode" TEXT,
    "detailGroupId" TEXT,
    "detail" TEXT,
    "bocas" TEXT,
    "observations" TEXT,
    "line" TEXT,
    "vehicles" TEXT,
    "measures" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL,
    "changes" JSONB,
    "changedAt" TIMESTAMP(3),
    CONSTRAINT "insur_article_data_pkey" PRIMARY KEY ("linkId")
);
CREATE INDEX "insur_article_data_detailGroupId_idx" ON "insur_article_data"("detailGroupId");
ALTER TABLE "insur_article_data" ADD CONSTRAINT "insur_article_data_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "insur_article_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "insur_sync_runs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT,
    "origin" TEXT NOT NULL,
    "preview" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "read" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL DEFAULT 0,
    "linked" INTEGER NOT NULL DEFAULT 0,
    "stockChanges" INTEGER NOT NULL DEFAULT 0,
    "costChanges" INTEGER NOT NULL DEFAULT 0,
    "suspicious" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "insur_sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "insur_sync_runs_accountId_startedAt_idx" ON "insur_sync_runs"("accountId", "startedAt");
ALTER TABLE "insur_sync_runs" ADD CONSTRAINT "insur_sync_runs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

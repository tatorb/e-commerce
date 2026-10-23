-- El paso Precio, antes de Publicación: parámetros por cuenta, costo y parámetros propios del producto, y las decisiones de precio.
ALTER TYPE "PipelineStep" ADD VALUE 'PRICE' BEFORE 'PUBLISH';

ALTER TABLE "products" ADD COLUMN "replacementCost" DECIMAL(14,2),
ADD COLUMN "pricingOverrides" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "pricing_settings" (
    "accountId" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("accountId")
);

CREATE TABLE "price_decisions" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "listPrice" DECIMAL(14,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "installments" INTEGER NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "marginPct" DECIMAL(8,2) NOT NULL,
    "minMarginPct" DECIMAL(6,2) NOT NULL,
    "params" JSONB NOT NULL,
    "belowMinConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_decisions_publicationId_decidedAt_idx" ON "price_decisions"("publicationId", "decidedAt");

ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "price_decisions" ADD CONSTRAINT "price_decisions_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_decisions" ADD CONSTRAINT "price_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

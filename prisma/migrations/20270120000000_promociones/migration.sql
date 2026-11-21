-- Promociones: los ajustes de la cuenta, las etiquetas de cada producto, el
-- calendario de eventos, la copia de las invitaciones del canal, el almanaque
-- con sus franjas por forma de cobro y la bitácora. Solo agrega tablas.
-- CreateTable
CREATE TABLE "promotion_settings" (
    "accountId" TEXT NOT NULL,
    "healthyMarginPct" DECIMAL(6,2) NOT NULL DEFAULT 15,
    "floorMarginPct" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "sweep" JSONB NOT NULL DEFAULT '{}',
    "sweptAt" TIMESTAMP(3),
    "classifiedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_settings_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "product_promotions" (
    "productId" TEXT NOT NULL,
    "lifecycle" TEXT,
    "competition" TEXT,
    "inCatalog" BOOLEAN NOT NULL DEFAULT false,
    "stockControl" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT,
    "manual" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "why" JSONB NOT NULL DEFAULT '{}',
    "plannedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_promotions_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "promotion_options" (
    "publicationId" TEXT NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "why" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_options_pkey" PRIMARY KEY ("publicationId")
);

-- CreateTable
CREATE TABLE "promotion_events" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "finish" TIMESTAMP(3) NOT NULL,
    "match" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_promotion_items" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "price" DECIMAL(14,2),
    "channelPct" DECIMAL(7,4),
    "sellerPct" DECIMAL(7,4),
    "start" TIMESTAMP(3),
    "finish" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "join" TEXT,
    "minPrice" DECIMAL(14,2),
    "maxPrice" DECIMAL(14,2),
    "suggestedPrice" DECIMAL(14,2),
    "stockMin" INTEGER,
    "stockMax" INTEGER,
    "canLeave" BOOLEAN NOT NULL DEFAULT false,
    "pausesOwnDiscount" BOOLEAN NOT NULL DEFAULT false,
    "listPrice" DECIMAL(14,2),
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_promotion_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_slots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "group" TEXT,
    "name" TEXT NOT NULL,
    "eventId" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "finish" TIMESTAMP(3) NOT NULL,
    "targetMarginPct" DECIMAL(6,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PLAN',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_slot_items" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "capped" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "reasonText" TEXT,
    "price" DECIMAL(14,2),
    "discountPct" DECIMAL(5,2),
    "marginPct" DECIMAL(8,2),
    "ref" TEXT,
    "stock" INTEGER,
    "appliedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextTryAt" TIMESTAMP(3),
    "measureAt" TIMESTAMP(3),
    "measuredAt" TIMESTAMP(3),

    CONSTRAINT "promotion_slot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_logs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "slotItemId" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "data" JSONB,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_promotions_lifecycle_idx" ON "product_promotions"("lifecycle");

-- CreateIndex
CREATE INDEX "promotion_events_accountId_start_idx" ON "promotion_events"("accountId", "start");

-- CreateIndex
CREATE INDEX "channel_promotion_items_group_idx" ON "channel_promotion_items"("group");

-- CreateIndex
CREATE UNIQUE INDEX "channel_promotion_items_publicationId_group_key" ON "channel_promotion_items"("publicationId", "group");

-- CreateIndex
CREATE INDEX "promotion_slots_accountId_start_idx" ON "promotion_slots"("accountId", "start");

-- CreateIndex
CREATE INDEX "promotion_slots_productId_start_idx" ON "promotion_slots"("productId", "start");

-- CreateIndex
CREATE INDEX "promotion_slot_items_publicationId_idx" ON "promotion_slot_items"("publicationId");

-- CreateIndex
CREATE INDEX "promotion_slot_items_state_nextTryAt_idx" ON "promotion_slot_items"("state", "nextTryAt");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_slot_items_slotId_publicationId_key" ON "promotion_slot_items"("slotId", "publicationId");

-- CreateIndex
CREATE INDEX "promotion_logs_publicationId_createdAt_idx" ON "promotion_logs"("publicationId", "createdAt");

-- CreateIndex
CREATE INDEX "promotion_logs_accountId_createdAt_idx" ON "promotion_logs"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "promotion_settings" ADD CONSTRAINT "promotion_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_promotions" ADD CONSTRAINT "product_promotions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_options" ADD CONSTRAINT "promotion_options_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_events" ADD CONSTRAINT "promotion_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_promotion_items" ADD CONSTRAINT "channel_promotion_items_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_slots" ADD CONSTRAINT "promotion_slots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_slots" ADD CONSTRAINT "promotion_slots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_slots" ADD CONSTRAINT "promotion_slots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "promotion_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_slot_items" ADD CONSTRAINT "promotion_slot_items_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "promotion_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_slot_items" ADD CONSTRAINT "promotion_slot_items_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_logs" ADD CONSTRAINT "promotion_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_logs" ADD CONSTRAINT "promotion_logs_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;


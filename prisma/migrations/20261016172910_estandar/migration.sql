-- CreateTable
CREATE TABLE "standard_rules" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "check" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "weight" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standard_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standard_rules_accountId_channelId_position_idx" ON "standard_rules"("accountId", "channelId", "position");

-- AddForeignKey
ALTER TABLE "standard_rules" ADD CONSTRAINT "standard_rules_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_rules" ADD CONSTRAINT "standard_rules_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

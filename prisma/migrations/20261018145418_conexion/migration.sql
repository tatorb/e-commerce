-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('NOT_CONNECTED', 'ACTIVE', 'NEEDS_REAUTH');

-- AlterTable
ALTER TABLE "channel_probes" ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "channel_connections" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "appSecretHint" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "externalUserId" TEXT,
    "externalNickname" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "connectedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "lastRefreshAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_attempts" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connect_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_connections_storeId_key" ON "channel_connections"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "connect_attempts_state_key" ON "connect_attempts"("state");

-- CreateIndex
CREATE INDEX "connect_attempts_storeId_idx" ON "connect_attempts"("storeId");

-- AddForeignKey
ALTER TABLE "channel_probes" ADD CONSTRAINT "channel_probes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_attempts" ADD CONSTRAINT "connect_attempts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_attempts" ADD CONSTRAINT "connect_attempts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

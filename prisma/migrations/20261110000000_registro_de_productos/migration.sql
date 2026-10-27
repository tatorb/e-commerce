-- Registro de productos: protocolos con pasos para sacar fotos y videos, y lo
-- que se sacó con ellos, con su medida.
CREATE TYPE "ShootKind" AS ENUM ('PHOTO', 'VIDEO');

CREATE TABLE "shoot_protocols" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoot_protocols_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shoot_protocols_accountId_position_idx" ON "shoot_protocols"("accountId", "position");
ALTER TABLE "shoot_protocols" ADD CONSTRAINT "shoot_protocols_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shoot_protocols" ADD CONSTRAINT "shoot_protocols_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "shoot_steps" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "kind" "ShootKind" NOT NULL DEFAULT 'PHOTO',
    "explanation" TEXT NOT NULL DEFAULT '',
    "illustrationUrl" TEXT,
    "illustrationType" TEXT,
    "illustrationName" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoot_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shoot_steps_protocolId_position_idx" ON "shoot_steps"("protocolId", "position");
ALTER TABLE "shoot_steps" ADD CONSTRAINT "shoot_steps_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "shoot_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "photo_edits" ADD COLUMN "shot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "photo_edits" ADD COLUMN "placedAt" TIMESTAMP(3);
ALTER TABLE "photo_edits" ADD COLUMN "shootStepId" TEXT;
ALTER TABLE "photo_edits" ADD COLUMN "variantKey" TEXT;
ALTER TABLE "photo_edits" ADD COLUMN "variantLabel" TEXT;
CREATE INDEX "photo_edits_shot_placedAt_idx" ON "photo_edits"("shot", "placedAt");
ALTER TABLE "photo_edits" ADD CONSTRAINT "photo_edits_shootStepId_fkey" FOREIGN KEY ("shootStepId") REFERENCES "shoot_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_videos" ADD COLUMN "shot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product_videos" ADD COLUMN "shootStepId" TEXT;
ALTER TABLE "product_videos" ADD COLUMN "variantKey" TEXT;
ALTER TABLE "product_videos" ADD COLUMN "variantLabel" TEXT;
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_shootStepId_fkey" FOREIGN KEY ("shootStepId") REFERENCES "shoot_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

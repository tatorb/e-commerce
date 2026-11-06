-- Opciones de venta: varias publicaciones del canal para la misma medida.
ALTER TABLE "publications" ADD COLUMN "mainOptionId" TEXT;
ALTER TABLE "publications" ADD CONSTRAINT "publications_mainOptionId_fkey" FOREIGN KEY ("mainOptionId") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "publications_mainOptionId_idx" ON "publications"("mainOptionId");

ALTER TABLE "channel_copies" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "channel_copies" ADD COLUMN "channelProductId" TEXT;
CREATE INDEX "channel_copies_channelProductId_idx" ON "channel_copies"("channelProductId");

-- La medida del canal, que hasta ahora se guardaba solo entre los detalles.
UPDATE "channel_copies" SET "channelProductId" = NULLIF("details"->>'channelProductId', '') WHERE "details" ? 'channelProductId';

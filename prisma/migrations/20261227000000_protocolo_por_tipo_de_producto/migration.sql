-- Cada protocolo es de un tipo de producto, y un video copiado al Drive busca
-- su paso por el tipo de su producto. Solo agrega columnas.
-- AlterTable
ALTER TABLE "shoot_protocols" ADD COLUMN     "productType" TEXT;

-- AlterTable
ALTER TABLE "shoot_steps" ADD COLUMN     "driveDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_videos" ADD COLUMN     "stepChosen" BOOLEAN NOT NULL DEFAULT false;

-- Los protocolos que ya existen: Subconjuntos y Camisas quedan con su tipo,
-- si la cuenta tiene ese tipo en su lista y no hay otro protocolo en uso con él.
UPDATE "shoot_protocols" p
SET "productType" = t.type
FROM (VALUES ('Subconjuntos', 'Subconjunto (pistones + aros)'), ('Camisas', 'Camisas')) AS t(name, type)
WHERE p."name" = t.name
  AND p."productType" IS NULL
  AND p."archivedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "product_options" o WHERE o."accountId" = p."accountId" AND o."kind" = 'TYPE' AND o."name" = t.type)
  AND NOT EXISTS (SELECT 1 FROM "shoot_protocols" q WHERE q."accountId" = p."accountId" AND q."productType" = t.type AND q."archivedAt" IS NULL);

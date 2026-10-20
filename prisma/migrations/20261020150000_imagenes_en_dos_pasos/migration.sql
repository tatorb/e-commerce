-- La línea de imágenes pasa de 8 pasos a 2: Corregir la foto, y Recortar y
-- exportar. Lo que se guardaba por paso ahora se guarda por ajuste, en parts.
-- AlterTable
ALTER TABLE "photo_step_runs" DROP COLUMN "measures",
DROP COLUMN "notApplicable",
DROP COLUMN "note",
DROP COLUMN "params",
DROP COLUMN "proposal",
DROP COLUMN "values",
ADD COLUMN     "parts" JSONB;


-- Las fotos que estaban a mitad de camino vuelven a empezar desde el
-- original, en el paso nuevo 1. Los intentos viejos quedan como reemplazados.
UPDATE "photo_step_runs" SET "status" = 'REPLACED', "openFor" = NULL WHERE "status" <> 'REPLACED';

INSERT INTO "photo_step_runs" ("id", "editId", "step", "status", "openFor", "settings", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."id", 0, 'QUEUED', e."id", COALESCE(ps."values", '{}'::jsonb), now(), now()
FROM "photo_edits" e
JOIN "products" p ON p."id" = e."productId"
LEFT JOIN "photo_settings" ps ON ps."accountId" = p."accountId"
WHERE e."archivedAt" IS NULL;

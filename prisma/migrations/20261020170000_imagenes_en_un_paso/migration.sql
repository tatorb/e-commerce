-- La línea de imágenes pasa a un solo paso con los 8 ajustes: la Mac los hace
-- de corrido y se aprueba una vez. Las fotos de la línea vuelven a empezar
-- desde el original; los intentos viejos quedan como reemplazados.
UPDATE "photo_step_runs" SET "status" = 'REPLACED', "openFor" = NULL WHERE "status" <> 'REPLACED';

INSERT INTO "photo_step_runs" ("id", "editId", "step", "status", "openFor", "settings", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."id", 0, 'QUEUED', e."id", COALESCE(ps."values", '{}'::jsonb), now(), now()
FROM "photo_edits" e
JOIN "products" p ON p."id" = e."productId"
LEFT JOIN "photo_settings" ps ON ps."accountId" = p."accountId"
WHERE e."archivedAt" IS NULL;

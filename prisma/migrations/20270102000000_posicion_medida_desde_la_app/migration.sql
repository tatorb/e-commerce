-- La posición medida desde la app: el código que apareció, si es orgánico y los primeros 5.
ALTER TABLE "search_positions" ADD COLUMN "matchedCode" TEXT,
ADD COLUMN "organic" BOOLEAN,
ADD COLUMN "top" JSONB;

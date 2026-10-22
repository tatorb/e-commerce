-- Las medidas que el canal guarda como publicaciones aparte, agrupadas en una familia.
ALTER TABLE "publications" ADD COLUMN "variantListings" JSONB NOT NULL DEFAULT '[]';

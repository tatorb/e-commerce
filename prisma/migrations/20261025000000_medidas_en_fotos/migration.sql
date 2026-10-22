-- De qué medidas es cada video en la publicación.
ALTER TABLE "publications" ADD COLUMN "videoVariants" JSONB NOT NULL DEFAULT '{}';

-- Cada variante de la publicación en el canal, con el código de sus fotos.
ALTER TABLE "channel_copies" ADD COLUMN "variations" JSONB NOT NULL DEFAULT '[]';

-- La garantía de cada publicación, la que se leyó del canal y la de la cuenta.
-- Vacías: las publicaciones siguen a la garantía que tienen en el canal.
ALTER TABLE "publications" ADD COLUMN "warranty" JSONB;
ALTER TABLE "channel_copies" ADD COLUMN "warranty" JSONB;
ALTER TABLE "accounts" ADD COLUMN "warranty" JSONB;

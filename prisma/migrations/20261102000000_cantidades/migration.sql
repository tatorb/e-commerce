-- Las cantidades disponibles: lo que se cambió en la app y lo que se leyó del canal.
ALTER TABLE "publications" ADD COLUMN "quantities" JSONB;

ALTER TABLE "channel_copies" ADD COLUMN "quantity" INTEGER,
ADD COLUMN "stockInChannel" BOOLEAN NOT NULL DEFAULT false;

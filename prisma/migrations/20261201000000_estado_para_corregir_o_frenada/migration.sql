-- Si el canal pide corregir la publicación para reactivarla, y si la frenó por sus políticas.
ALTER TABLE "channel_copies" ADD COLUMN "statusNeedsFix" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channel_copies" ADD COLUMN "statusBlocked" BOOLEAN NOT NULL DEFAULT false;

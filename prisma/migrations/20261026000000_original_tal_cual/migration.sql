-- La foto ya viene editada: se usa el original tal cual.
ALTER TABLE "photo_edits" ADD COLUMN "asIs" BOOLEAN NOT NULL DEFAULT false;

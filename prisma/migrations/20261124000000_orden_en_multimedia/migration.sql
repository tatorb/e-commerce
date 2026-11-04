-- El lugar de las fotos de cada paso en Organización de multimedia. Arranca
-- igual que el orden en que se sacan.
ALTER TABLE "shoot_steps" ADD COLUMN "mediaPosition" INTEGER NOT NULL DEFAULT 0;
UPDATE "shoot_steps" SET "mediaPosition" = "position";

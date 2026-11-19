-- La música de fondo se elige en cada pedido de edición. Sin pedirla, el clip no lleva.
ALTER TABLE "video_edits" ADD COLUMN "musicOn" BOOLEAN NOT NULL DEFAULT false;

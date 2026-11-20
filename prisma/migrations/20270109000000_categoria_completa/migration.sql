-- Las categorías leídas con todos los atributos que acepta el canal, no solo los de su formulario.
ALTER TABLE "channel_categories" ADD COLUMN "full" BOOLEAN NOT NULL DEFAULT false;

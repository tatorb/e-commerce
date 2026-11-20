-- La principal nueva de un producto recreado en otra categoría: de cuál salió, para retomar si se corta.
ALTER TABLE "publications" ADD COLUMN "recreatedFromId" TEXT;

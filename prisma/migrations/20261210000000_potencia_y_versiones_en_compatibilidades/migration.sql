-- La potencia y las versiones que no van, en cada compatibilidad de la ficha: sirven para elegir los vehículos del canal.
ALTER TABLE "compatibilities" ADD COLUMN "power" TEXT;
ALTER TABLE "compatibilities" ADD COLUMN "excludedVersions" TEXT;

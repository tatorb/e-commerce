-- Las imágenes subidas a mano a la carpeta Imágenes con texto del Drive:
-- aparecen en Organización de multimedia para ordenarlas.
ALTER TABLE "text_images" ADD COLUMN "fromDrive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "text_images" ADD COLUMN "fileName" TEXT;
ALTER TABLE "text_images" ADD COLUMN "fileType" TEXT;

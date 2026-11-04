-- Varias imágenes con texto por publicación, cada una con su número y su
-- lugar fijo en Organización de multimedia. Las que ya había quedan como la
-- Imagen 1, sin lugar fijo.
ALTER TABLE "text_images" ADD COLUMN "slot" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "text_images" ADD COLUMN "mediaPlace" INTEGER;

CREATE TABLE "publication_text_images" (
    "publicationId" TEXT NOT NULL,
    "textImageId" TEXT NOT NULL,
    CONSTRAINT "publication_text_images_pkey" PRIMARY KEY ("publicationId","textImageId")
);
CREATE INDEX "publication_text_images_textImageId_idx" ON "publication_text_images"("textImageId");
ALTER TABLE "publication_text_images" ADD CONSTRAINT "publication_text_images_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_text_images" ADD CONSTRAINT "publication_text_images_textImageId_fkey" FOREIGN KEY ("textImageId") REFERENCES "text_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "publication_text_images" ("publicationId", "textImageId")
SELECT "id", "textImageId" FROM "publications" WHERE "textImageId" IS NOT NULL;

ALTER TABLE "publications" DROP CONSTRAINT IF EXISTS "publications_textImageId_fkey";
ALTER TABLE "publications" DROP COLUMN "textImageId";

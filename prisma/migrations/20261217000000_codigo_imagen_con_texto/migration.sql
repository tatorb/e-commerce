-- El código que el canal le dio a la imagen con texto en cada publicación.
ALTER TABLE "publication_text_images" ADD COLUMN "channelPhotoId" TEXT;
ALTER TABLE "publication_text_images" ADD COLUMN "channelPhotoAt" TIMESTAMP(3);
ALTER TABLE "publication_text_images" ADD COLUMN "channelPngAt" TIMESTAMP(3);
ALTER TABLE "publication_text_images" ADD COLUMN "channelFound" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "publication_text_images" ADD COLUMN "channelCheckedKey" TEXT;

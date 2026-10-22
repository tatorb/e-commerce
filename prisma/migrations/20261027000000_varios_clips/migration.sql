-- Una publicación puede tener varios clips, en orden. El que ya estaba elegido queda primero.
ALTER TABLE "publication_clips" DROP CONSTRAINT "publication_clips_pkey";
ALTER TABLE "publication_clips" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "publication_clips" ADD CONSTRAINT "publication_clips_pkey" PRIMARY KEY ("publicationId", "videoId");

-- La edición puede quedar pre-aprobada y con la orden de subir el clip. Solo agrega.
-- AlterTable
ALTER TABLE "video_edits" ADD COLUMN     "approveWhenDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uploadWhenApproved" BOOLEAN NOT NULL DEFAULT false;

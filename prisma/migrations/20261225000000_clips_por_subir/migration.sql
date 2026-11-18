-- Clips por subir: cuándo se ofreció cada clip aprobado a las publicaciones del producto. Solo agrega.
-- AlterTable
ALTER TABLE "video_edits" ADD COLUMN     "clipOfferedAt" TIMESTAMP(3);

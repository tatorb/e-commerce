-- La cola de subida de clips, que atiende la extensión de Chrome. Solo agrega.
-- AlterTable
ALTER TABLE "publication_clips" ADD COLUMN     "uploadAskedAt" TIMESTAMP(3),
ADD COLUMN     "uploadTriedAt" TIMESTAMP(3),
ADD COLUMN     "uploadAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "uploadError" TEXT;

-- CreateTable
CREATE TABLE "clip_uploaders" (
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "version" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clip_uploaders_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "clip_uploaders" ADD CONSTRAINT "clip_uploaders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Editor de videos: los momentos del video en el protocolo, el guión y el sonido
-- de cada edición, y cómo se editan los videos de cada cuenta. Solo agrega.
-- AlterTable
ALTER TABLE "shoot_steps" ADD COLUMN     "moments" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "video_edits" ADD COLUMN     "requestedScript" JSONB,
ADD COLUMN     "script" JSONB,
ADD COLUMN     "sound" JSONB;

-- CreateTable
CREATE TABLE "video_account_settings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_account_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_account_settings_accountId_key" ON "video_account_settings"("accountId");

-- AddForeignKey
ALTER TABLE "video_account_settings" ADD CONSTRAINT "video_account_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


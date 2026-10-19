-- Importaciones que leen las publicaciones desde el canal, con la cuenta conectada.
CREATE TYPE "ImportOrigin" AS ENUM ('FILE', 'CHANNEL_API');

ALTER TABLE "import_runs" ADD COLUMN "origin" "ImportOrigin" NOT NULL DEFAULT 'FILE';

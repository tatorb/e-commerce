-- Las publicaciones que hay que finalizar en el canal y todavía no se pudo.
ALTER TABLE "publications" ADD COLUMN "closeWantedAt" TIMESTAMP(3),
ADD COLUMN "closeWantedWhy" TEXT,
ADD COLUMN "closeTaskId" TEXT;

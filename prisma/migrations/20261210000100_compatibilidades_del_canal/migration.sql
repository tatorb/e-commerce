-- Las compatibilidades con vehículos que tiene cargadas cada publicación en el canal, y su auditoría contra la ficha.
CREATE TABLE "publication_compatibilities" (
    "publicationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "needed" BOOLEAN NOT NULL DEFAULT false,
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "vehicles" JSONB NOT NULL,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "extra" INTEGER NOT NULL DEFAULT 0,
    "review" INTEGER NOT NULL DEFAULT 0,
    "noData" BOOLEAN NOT NULL DEFAULT false,
    "audit" JSONB,

    CONSTRAINT "publication_compatibilities_pkey" PRIMARY KEY ("publicationId")
);

ALTER TABLE "publication_compatibilities" ADD CONSTRAINT "publication_compatibilities_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las listas del catálogo de vehículos de cada canal, guardadas un tiempo.
CREATE TABLE "channel_catalog_values" (
    "key" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_catalog_values_pkey" PRIMARY KEY ("key")
);

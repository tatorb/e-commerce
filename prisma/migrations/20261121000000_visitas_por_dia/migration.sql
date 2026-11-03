-- Las visitas de cada publicación, día por día.
ALTER TABLE "publications" ADD COLUMN "visitsReadAt" TIMESTAMP(3);

CREATE TABLE "publication_visit_days" (
    "publicationId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visits" INTEGER NOT NULL,

    CONSTRAINT "publication_visit_days_pkey" PRIMARY KEY ("publicationId","day")
);

ALTER TABLE "publication_visit_days" ADD CONSTRAINT "publication_visit_days_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

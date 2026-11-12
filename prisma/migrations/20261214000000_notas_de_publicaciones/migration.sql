-- Notas del equipo sobre las publicaciones, de la familia.
CREATE TABLE "publication_notes" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "familyId" TEXT,
    "text" TEXT NOT NULL,
    "step" "PipelineStep",
    "authorId" TEXT,
    "viaClaude" BOOLEAN NOT NULL DEFAULT false,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "mentionedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "publication_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "publication_notes_publicationId_idx" ON "publication_notes"("publicationId");
CREATE INDEX "publication_notes_familyId_idx" ON "publication_notes"("familyId");
CREATE INDEX "publication_notes_accountId_createdAt_idx" ON "publication_notes"("accountId", "createdAt");
ALTER TABLE "publication_notes" ADD CONSTRAINT "publication_notes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_notes" ADD CONSTRAINT "publication_notes_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_notes" ADD CONSTRAINT "publication_notes_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "listing_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publication_notes" ADD CONSTRAINT "publication_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publication_notes" ADD CONSTRAINT "publication_notes_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

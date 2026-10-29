-- Sumarse a una campaña del canal o salir, pedido desde el Pipeline: queda en
-- Por subir hasta que se manda con los demás cambios.
CREATE TYPE "CampaignAction" AS ENUM ('JOIN', 'LEAVE');

CREATE TABLE "campaign_requests" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "action" "CampaignAction" NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "price" DECIMAL(14,2),
    "rejection" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_requests_publicationId_ref_key" ON "campaign_requests"("publicationId", "ref");

ALTER TABLE "campaign_requests" ADD CONSTRAINT "campaign_requests_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_requests" ADD CONSTRAINT "campaign_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

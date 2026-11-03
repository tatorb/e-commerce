-- Las publicaciones vendidas que el canal no devolvió al traerlas.
CREATE TABLE "channel_listing_misses" (
    "storeId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_listing_misses_pkey" PRIMARY KEY ("storeId","externalId")
);

ALTER TABLE "channel_listing_misses" ADD CONSTRAINT "channel_listing_misses_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que manda el canal de cada pregunta y del comprador que la hizo.
ALTER TABLE "buyer_questions" ADD COLUMN "buyerAnswered" INTEGER;
ALTER TABLE "buyer_questions" ADD COLUMN "statusNote" TEXT;

CREATE TABLE "channel_buyers" (
    "storeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "nickname" TEXT,
    "city" TEXT,
    "state" TEXT,
    "registeredAt" TIMESTAMP(3),
    "profileUrl" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL,
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "channel_buyers_pkey" PRIMARY KEY ("storeId","buyerId")
);

ALTER TABLE "channel_buyers" ADD CONSTRAINT "channel_buyers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las cuotas y el descuento de cada publicación, en la app y en la cara del canal, y la renovación del descuento.
ALTER TYPE "SyncChangeKind" ADD VALUE 'RENEWED';

ALTER TABLE "publications" ADD COLUMN "installments" INTEGER,
ADD COLUMN "discount" DECIMAL(5,2);

ALTER TABLE "channel_copies" ADD COLUMN "installments" INTEGER,
ADD COLUMN "discount" DECIMAL(5,2),
ADD COLUMN "discountUntil" TIMESTAMP(3),
ADD COLUMN "discountSentAt" TIMESTAMP(3);

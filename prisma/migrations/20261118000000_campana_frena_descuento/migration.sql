-- Si la campaña pedida frena el descuento propio: al subir, el descuento no va.
ALTER TABLE "campaign_requests" ADD COLUMN "pausesOwnDiscount" BOOLEAN NOT NULL DEFAULT false;

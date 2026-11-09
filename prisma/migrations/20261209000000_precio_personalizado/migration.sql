-- Una opción de venta con precio personalizado: no se recalcula desde el precio sin cuotas.
ALTER TABLE "publications" ADD COLUMN "customPrice" BOOLEAN NOT NULL DEFAULT false;

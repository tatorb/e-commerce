-- Promociones: el modo es de cada producto (Manual o Automático) y la cuenta queda solo con un freno de emergencia.
-- Solo agrega columnas.
ALTER TABLE "product_promotions" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "promotion_settings" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "promotion_slot_items" ADD COLUMN "fixed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priceBy" TEXT,
ADD COLUMN "priceValue" DECIMAL(14,2);

-- Las cuentas que no tenían prendida la ejecución automática arrancan con el freno puesto: la app sigue sin mandar nada hasta que se suelte.
UPDATE "promotion_settings" SET "paused" = NOT "autoApply";

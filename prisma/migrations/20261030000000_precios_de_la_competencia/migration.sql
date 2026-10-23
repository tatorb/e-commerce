-- El precio de cada publicación de la competencia: vendedor, precio de lista, descuento, cuotas, envío, fecha y notas.
ALTER TABLE "competitor_listings" ADD COLUMN "sellerName" TEXT,
ADD COLUMN "listPrice" DECIMAL(14,2),
ADD COLUMN "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "installments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "freeShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "surveyedAt" DATE,
ADD COLUMN "notes" TEXT;

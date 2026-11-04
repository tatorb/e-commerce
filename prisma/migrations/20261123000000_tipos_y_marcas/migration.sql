-- Listas fijas de tipos de producto y marcas por cuenta, armadas con lo que ya está cargado.
CREATE TYPE "ProductOptionKind" AS ENUM ('TYPE', 'BRAND');

CREATE TABLE "product_options" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "ProductOptionKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_options_accountId_kind_name_key" ON "product_options"("accountId", "kind", "name");

ALTER TABLE "product_options" ADD CONSTRAINT "product_options_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sin espacios de más; vacío es sin dato. El tipo "test" era una prueba: se borra.
UPDATE "products" SET "productType" = NULLIF(regexp_replace(btrim("productType"), '\s+', ' ', 'g'), '') WHERE "productType" IS NOT NULL;
UPDATE "products" SET "brand" = NULLIF(regexp_replace(btrim("brand"), '\s+', ' ', 'g'), '') WHERE "brand" IS NOT NULL;
UPDATE "products" SET "productType" = NULL WHERE lower("productType") = 'test';

-- Las que se escribieron distinto (mayúsculas o acentos) pasan a la forma más usada de la cuenta.
WITH v AS (
  SELECT "accountId", "productType" AS name, translate(lower("productType"), 'áéíóúüñ', 'aeiouun') AS key, count(*) AS n
  FROM "products" WHERE "productType" IS NOT NULL GROUP BY 1, 2, 3
), c AS (
  SELECT DISTINCT ON ("accountId", key) "accountId", key, name FROM v ORDER BY "accountId", key, n DESC, name
)
UPDATE "products" p SET "productType" = c.name
FROM c WHERE p."accountId" = c."accountId" AND translate(lower(p."productType"), 'áéíóúüñ', 'aeiouun') = c.key AND p."productType" <> c.name;

WITH v AS (
  SELECT "accountId", "brand" AS name, translate(lower("brand"), 'áéíóúüñ', 'aeiouun') AS key, count(*) AS n
  FROM "products" WHERE "brand" IS NOT NULL GROUP BY 1, 2, 3
), c AS (
  SELECT DISTINCT ON ("accountId", key) "accountId", key, name FROM v ORDER BY "accountId", key, n DESC, name
)
UPDATE "products" p SET "brand" = c.name
FROM c WHERE p."accountId" = c."accountId" AND translate(lower(p."brand"), 'áéíóúüñ', 'aeiouun') = c.key AND p."brand" <> c.name;

INSERT INTO "product_options" ("id", "accountId", "kind", "name")
SELECT md5(random()::text || clock_timestamp()::text || "accountId" || "productType"), "accountId", 'TYPE', "productType"
FROM (SELECT DISTINCT "accountId", "productType" FROM "products" WHERE "productType" IS NOT NULL) t;

INSERT INTO "product_options" ("id", "accountId", "kind", "name")
SELECT md5(random()::text || clock_timestamp()::text || "accountId" || "brand"), "accountId", 'BRAND', "brand"
FROM (SELECT DISTINCT "accountId", "brand" FROM "products" WHERE "brand" IS NOT NULL) t;

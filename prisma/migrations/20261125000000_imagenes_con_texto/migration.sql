-- El paso Imágenes con texto, la base de marcas de vehículos y la pieza de cada
-- publicación. El orden de los pasos lo arma la app, no la base.
-- AlterEnum
ALTER TYPE "PipelineStep" ADD VALUE 'TEXT_IMAGES' AFTER 'IMAGES';

-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "textImageId" TEXT;

-- CreateTable
CREATE TABLE "vehicle_brands" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo" BYTEA,
    "logoType" TEXT,
    "logoUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_images" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "photoEditId" TEXT,
    "pngRef" TEXT,
    "pngAt" TIMESTAMP(3),
    "pngHash" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_brands_key_key" ON "vehicle_brands"("key");

-- CreateIndex
CREATE INDEX "text_images_accountId_idx" ON "text_images"("accountId");

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_textImageId_fkey" FOREIGN KEY ("textImageId") REFERENCES "text_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_images" ADD CONSTRAINT "text_images_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Las marcas de entrada, sin logo: los logos oficiales se suben desde la app.
INSERT INTO "vehicle_brands" ("id", "key", "name", "aliases", "updatedAt") VALUES
  ('vb_fiat', 'fiat', 'Fiat', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_ford', 'ford', 'Ford', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_chevrolet', 'chevrolet', 'Chevrolet', ARRAY['Chevy', 'GM', 'General Motors']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_volkswagen', 'volkswagen', 'Volkswagen', ARRAY['VW', 'Volks', 'Volkswagen']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_renault', 'renault', 'Renault', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_peugeot', 'peugeot', 'Peugeot', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_citroen', 'citroen', 'Citroën', ARRAY['Citroen']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_toyota', 'toyota', 'Toyota', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_nissan', 'nissan', 'Nissan', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_honda', 'honda', 'Honda', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_mercedes-benz', 'mercedes-benz', 'Mercedes-Benz', ARRAY['Mercedes', 'Mercedes Benz', 'MB', 'Benz']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_iveco', 'iveco', 'Iveco', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_jeep', 'jeep', 'Jeep', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_ram', 'ram', 'RAM', ARRAY['Ram']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_dodge', 'dodge', 'Dodge', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_mitsubishi', 'mitsubishi', 'Mitsubishi', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_hyundai', 'hyundai', 'Hyundai', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_kia', 'kia', 'Kia', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_suzuki', 'suzuki', 'Suzuki', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_chery', 'chery', 'Chery', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_audi', 'audi', 'Audi', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_bmw', 'bmw', 'BMW', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_ika', 'ika', 'IKA', ARRAY['Industrias Kaiser Argentina', 'Kaiser']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_scania', 'scania', 'Scania', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_volvo', 'volvo', 'Volvo', ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('vb_john-deere', 'john-deere', 'John Deere', ARRAY['Deere', 'JD']::TEXT[], CURRENT_TIMESTAMP),
  ('vb_massey-ferguson', 'massey-ferguson', 'Massey Ferguson', ARRAY['Massey', 'MF']::TEXT[], CURRENT_TIMESTAMP);

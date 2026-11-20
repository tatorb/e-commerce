-- De a cuántas unidades del stock del producto vende cada publicación. Todas arrancan en 1.
ALTER TABLE "publications" ADD COLUMN "unitsPerSale" INTEGER NOT NULL DEFAULT 1;

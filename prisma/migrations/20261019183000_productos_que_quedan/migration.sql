-- Cuántos productos de la importación quedaron al deshacerla, para mostrarlo en el historial.
ALTER TABLE "import_runs" ADD COLUMN "productsKept" INTEGER NOT NULL DEFAULT 0;

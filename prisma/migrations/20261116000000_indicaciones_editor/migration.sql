-- Las indicaciones para el editor de cada paso de un protocolo de fotos, y la
-- indicación puntual de una corrida, que Claude recibe en el trabajador de imágenes.
ALTER TABLE "shoot_steps" ADD COLUMN "editorNotes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "photo_step_runs" ADD COLUMN "note" TEXT;

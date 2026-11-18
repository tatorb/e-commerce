-- El guión del clip: cómo se escribe cada frase en los subtítulos, cuando no es igual a lo que dice la voz. Solo agrega.
-- AlterTable
ALTER TABLE "video_scripts" ADD COLUMN     "shown" JSONB;

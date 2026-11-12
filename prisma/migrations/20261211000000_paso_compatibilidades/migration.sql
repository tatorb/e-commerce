-- El paso Compatibilidades, entre Título y Descripción. El orden de los pasos lo arma la app, no la base.
-- AlterEnum
ALTER TYPE "PipelineStep" ADD VALUE 'COMPATIBILITIES' AFTER 'TITLE';

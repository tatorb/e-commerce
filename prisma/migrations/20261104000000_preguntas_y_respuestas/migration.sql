-- Paso Preguntas y respuestas, después de Descripción.
ALTER TYPE "PipelineStep" ADD VALUE 'QA' BEFORE 'PRICE';

-- Las preguntas frecuentes, las reglas y si Claude responde solo, por publicación.
ALTER TABLE "publications" ADD COLUMN "faq" TEXT,
ADD COLUMN "answerRules" TEXT,
ADD COLUMN "autoAnswer" BOOLEAN NOT NULL DEFAULT false;

-- Claude mandó la respuesta solo.
ALTER TYPE "DraftOutcome" ADD VALUE 'SENT_AUTO';

-- Cuánto espera Claude, como mínimo, desde que llega la pregunta hasta mandar sola la respuesta.
ALTER TABLE "question_settings" ADD COLUMN "answerDelaySeconds" INTEGER NOT NULL DEFAULT 40;

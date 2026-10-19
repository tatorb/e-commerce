-- Las preguntas de los compradores en la publicación propia pasan a ser de
-- cada publicación. Las que había en el producto se copian a todas sus
-- publicaciones, para no perder nada.
ALTER TABLE "publications" ADD COLUMN "ownQuestions" TEXT;

UPDATE "publications" AS p
SET "ownQuestions" = r."ownQuestions"
FROM "product_research" AS r
WHERE r."productId" = p."productId" AND r."ownQuestions" IS NOT NULL;

ALTER TABLE "product_research" DROP COLUMN "ownQuestions";

-- Un individual dentro de un combo no se puede borrar, pero el control se
-- hace al final de la transacción: así borrar un combo junto con sus
-- productos (deshacer una importación, borrar una cuenta) no se traba por el
-- orden en que se borran las filas.
ALTER TABLE "combo_items" ALTER CONSTRAINT "combo_items_productId_fkey" DEFERRABLE INITIALLY DEFERRED;

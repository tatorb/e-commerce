-- "Medidas sin ambigüedad" acepta la sobremedida y la bajomedida sin unidad
-- (-0,30, +0,50, 0,25). Se cambia el texto de las reglas que tienen el de
-- siempre; las que alguien escribió a mano quedan como están.
UPDATE "standard_rules"
SET "description" = 'STD, sobremedida o bajomedida con coma (-0,30, +0,50, 0,25) o con unidad, para que nadie dude entre 0.5, 050, mm o pulgadas.'
WHERE "check" = 'measures_unambiguous'
  AND "description" = 'STD o con unidad, para que nadie dude entre 0.5, 050, mm o pulgadas.';

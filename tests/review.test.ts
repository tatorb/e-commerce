import { describe, expect, it } from 'vitest';
import {
  composeList,
  defaultPicks,
  diffList,
  initialReviewValue,
  picksFromList,
  reviewFieldsInputSchema,
  toEditorValue,
  validateReview,
  wasEdited,
  type CompatRow,
  type ReviewField,
} from '@/domain/review';

// Datos inventados.
const base: ReviewField[] = [
  { field: 'title', value: 'Kit de prueba Marca A Modelo 1', included: true, fromAi: true },
  { field: 'description', value: 'Kit de prueba.\n\nGarantía\n- 6 meses', included: true, fromAi: true },
  { field: 'specs', value: [{ name: 'Material', value: 'acero' }, { name: '', value: '' }], included: true, fromAi: true },
  {
    field: 'compatibilities',
    value: [{ vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: '1995', yearTo: '2012', note: '' }],
    included: true,
    fromAi: true,
  },
  { field: 'measures', value: [{ id: 'v1', sku: 'ABC-1', measure: 'STD' }], included: true, fromAi: true },
];

const problems = (fields: ReviewField[], max: number | null = 60) =>
  validateReview(fields, { titleMaxLength: max }).problems.map((p) => p.message);

describe('validar la revisión', () => {
  it('aprueba lo correcto y deja los valores listos para escribir', () => {
    const r = validateReview(base, { titleMaxLength: 60 });
    expect(r.problems).toEqual([]);
    const byField = Object.fromEntries(r.fields.map((f) => [f.field, f.normalized]));
    expect(byField.specs).toEqual([{ name: 'Material', value: 'acero' }]);
    expect(byField.compatibilities).toEqual([
      { vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: 1995, yearTo: 2012, note: null },
    ]);
    expect(byField.measures).toEqual([{ id: 'v1', sku: 'ABC-1', measure: 'STD' }]);
  });

  it('frena marcas a confirmar, títulos largos, años inválidos y vacíos', () => {
    const bad = base.map((f): ReviewField => {
      if (f.field === 'title') return { ...f, value: 'x'.repeat(61) };
      if (f.field === 'description') return { ...f, value: 'Garantía: [A CONFIRMAR: plazo]' };
      if (f.field === 'compatibilities')
        return { ...f, value: [{ vehicleBrand: 'A', model: '', engine: '', yearFrom: 'noventa', yearTo: '', note: '' }] };
      if (f.field === 'specs') return { ...f, value: [{ name: 'Material', value: '' }] };
      return f;
    });
    expect(problems(bad)).toEqual([
      'Título: tiene 61 caracteres y el máximo del canal es 60.',
      'Descripción: falta completar «plazo».',
      'Ficha técnica: la fila 1 tiene el dato o el valor vacío.',
      'Compatibilidades: fila 1: El año tiene que ser un número, por ejemplo 2012.',
    ]);
  });

  it('lo que no se usa no frena, pero algo hay que usar', () => {
    const off = base.map((f) => (f.field === 'description' ? { ...f, value: '[A CONFIRMAR: todo]', included: false } : f));
    expect(problems(off)).toEqual([]);
    expect(problems(base.map((f) => ({ ...f, included: false })))).toEqual(['No hay ningún cambio marcado para usar.']);
  });

  it('un campo de texto vacío no se puede usar', () => {
    expect(problems([{ field: 'warranty', value: '  ', included: true, fromAi: false }])).toEqual([
      'Garantía: está vacío. Completalo o destildá "Usar este cambio".',
    ]);
  });

  it('sabe si la persona editó lo que propuso la IA', () => {
    const ai = [{ vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: 1995, yearTo: 2012, note: null }];
    const same = validateReview([{ ...base[3] }], { titleMaxLength: null }).fields[0].normalized;
    expect(wasEdited('compatibilities', same, ai)).toBe(false);
    expect(wasEdited('title', 'Otro', 'Kit')).toBe(true);
    expect(wasEdited('warranty', '6 meses', undefined)).toBe(true);
    expect(toEditorValue('compatibilities', ai)).toEqual(base[3].value);
  });

  it('solo acepta de la pantalla campos conocidos, con la forma de su tipo', () => {
    expect(reviewFieldsInputSchema.safeParse(base).success).toBe(true);
    const wrong = [{ field: 'measures', value: [{ name: 'x', value: 'y' }], included: true, fromAi: true }];
    expect(reviewFieldsInputSchema.safeParse(wrong).success).toBe(false);
    expect(reviewFieldsInputSchema.safeParse([{ field: 'price', value: '1', included: true, fromAi: true }]).success).toBe(false);
    expect(reviewFieldsInputSchema.safeParse([base[0], base[0]]).success).toBe(false);
  });
});

describe('listas fila por fila', () => {
  const compat = (vehicleBrand: string, model: string, engine = '', yearFrom = '', yearTo = ''): CompatRow => ({
    vehicleBrand,
    model,
    engine,
    yearFrom,
    yearTo,
    note: '',
  });
  const gol = compat('Volkswagen', 'Gol', '1.6', '2009', '2014');
  const corsa = compat('Chevrolet', 'Corsa', '1.6');
  const uno = compat('Fiat', 'Uno', '1.3');

  it('compatibilidades: lo que se suma, se saca y cambia, con lo que se saca en su lugar', () => {
    const changes = diffList('compatibilities', [gol, corsa, uno], [{ ...gol, yearTo: '2016' }, uno, compat('Fiat', 'Palio', '1.3')]);
    expect(changes.map((c) => c.kind)).toEqual(['change', 'remove', 'same', 'add']);
    expect(changes[1].row).toEqual(corsa);
  });

  it('con el orden cambiado, no se pierde ninguna fila', () => {
    const changes = diffList('compatibilities', [gol, corsa, uno], [uno, gol]);
    expect(changes.map((c) => c.kind)).toEqual(['same', 'same', 'remove']);
    expect(composeList(changes, defaultPicks(changes))).toEqual([uno, gol, corsa]);
  });

  it('por defecto no se saca nada', () => {
    const changes = diffList('compatibilities', [gol, corsa], [gol]);
    expect(defaultPicks(changes)).toEqual([true, false]);
    expect(composeList(changes, defaultPicks(changes))).toEqual([gol, corsa]);
    expect(composeList(changes, [true, true])).toEqual([gol]);
  });

  it('cambiar sin marcar deja la fila de hoy', () => {
    const changes = diffList('compatibilities', [gol], [{ ...gol, yearTo: '2016' }]);
    expect(composeList(changes, [false])).toEqual([gol]);
    expect(composeList(changes, [true])).toEqual([{ ...gol, yearTo: '2016' }]);
  });

  it('ficha técnica: la misma fila por el nombre del dato', () => {
    const changes = diffList(
      'specs',
      [
        { name: 'Diámetro', value: '200 mm' },
        { name: 'Estrías', value: '22' },
      ],
      [
        { name: 'diámetro', value: '210 mm' },
        { name: 'Material', value: 'Acero' },
      ],
    );
    expect(changes.map((c) => c.kind)).toEqual(['change', 'remove', 'add']);
  });

  it('medidas: cada variante por su id, aunque esté vacía', () => {
    const changes = diffList(
      'measures',
      [
        { id: 'v1', sku: 'A', measure: '' },
        { id: 'v2', sku: 'B', measure: 'STD' },
      ],
      [
        { id: 'v1', sku: 'A', measure: '0,50' },
        { id: 'v2', sku: 'B', measure: 'STD' },
      ],
    );
    expect(changes.map((c) => c.kind)).toEqual(['change', 'same']);
    // Una variante que falta en lo propuesto no se saca.
    const missing = diffList('measures', [{ id: 'v1', sku: 'A', measure: 'STD' }], []);
    expect(missing.map((c) => c.kind)).toEqual(['same']);
  });

  it('lee lo marcado de un borrador, y avisa si se editó a mano', () => {
    const changes = diffList('compatibilities', [gol, corsa], [gol, uno]);
    expect(picksFromList('compatibilities', changes, [gol, uno])).toEqual([true, true, true]);
    expect(picksFromList('compatibilities', changes, [gol, corsa])).toEqual([true, false, false]);
    expect(picksFromList('compatibilities', changes, [compat('Ford', 'Ka')])).toBeNull();
  });

  it('la revisión arranca sin sacar filas; los textos, como los propuso la IA', () => {
    const current = [{ vehicleBrand: 'Volkswagen', model: 'Gol', engine: '1.6', yearFrom: 2009, yearTo: 2014, note: null }];
    expect(initialReviewValue('compatibilities', current, [])).toEqual([gol]);
    expect(initialReviewValue('brand', 'SKF', 'Sachs')).toBe('Sachs');
  });
});

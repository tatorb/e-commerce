import { describe, expect, it } from 'vitest';
import { planContentUpdate, type ContentSnapshot } from '@/domain/content';

const empty: ContentSnapshot = {
  title: null,
  description: null,
  brand: null,
  partNumber: null,
  productType: null,
  engineSystem: null,
  line: null,
  origin: null,
  warranty: null,
  kitContents: null,
  notes: null,
  measures: [],
  specs: [],
  compatibilities: [],
  photos: [],
  videos: [],
};

const current: ContentSnapshot = {
  ...empty,
  title: 'Kit de prueba A',
  brand: 'Marca X',
  measures: [
    { id: 'v1', sku: 'ABC-1', measure: null },
    { id: 'v2', sku: 'ABC-2', measure: '0.5' },
  ],
  specs: [{ name: 'Material', value: 'acero' }],
};

const fields = (r: ReturnType<typeof planContentUpdate>) => r.changes.map((c) => `${c.field}:${c.kind}`);

describe('completar lo que ya está en la app', () => {
  it('lo que no viene no se toca', () => {
    expect(planContentUpdate(current, {}, 'REPLACE', { publication: true }).changes).toEqual([]);
  });

  it('solo completar: carga lo vacío y deja lo que había', () => {
    const r = planContentUpdate(
      current,
      {
        title: 'Otro título',
        brand: 'Marca X',
        warranty: '6 meses',
        measures: [
          { sku: 'abc-1', measure: 'STD' },
          { sku: 'ABC-2', measure: '0,50 mm' },
        ],
        specs: [{ name: 'Diámetro', value: '82 mm' }],
        photos: ['https://example.com/1.jpg'],
      },
      'FILL_EMPTY',
      { publication: true },
    );
    expect(fields(r)).toEqual(['warranty:fill', 'measures:fill', 'photos:fill']);
    const measures = r.changes.find((c) => c.field === 'measures')!;
    expect(measures.after).toEqual([
      { id: 'v1', sku: 'ABC-1', measure: 'STD' },
      { id: 'v2', sku: 'ABC-2', measure: '0.5' },
    ]);
  });

  it('completar y reemplazar: gana lo que llega', () => {
    const r = planContentUpdate(
      current,
      {
        title: 'Otro título',
        brand: 'Marca X',
        measures: [{ sku: 'ABC-2', measure: '0,50 mm' }],
        specs: [{ name: 'Diámetro', value: '82 mm' }],
      },
      'REPLACE',
      { publication: true },
    );
    expect(fields(r)).toEqual(['title:replace', 'measures:replace', 'specs:replace']);
    expect(r.changes[0]).toMatchObject({ before: 'Kit de prueba A', after: 'Otro título' });
  });

  it('sin publicación no toca título ni descripción', () => {
    const r = planContentUpdate(empty, { title: 'Nuevo', brand: 'Marca Y' }, 'REPLACE', { publication: false });
    expect(fields(r)).toEqual(['brand:fill']);
  });

  it('compara sin espacios ni saltos de línea distintos', () => {
    const withText = { ...empty, description: 'Línea 1\nLínea 2' };
    const r = planContentUpdate(withText, { description: '  Línea 1\r\nLínea 2 ' }, 'REPLACE', { publication: true });
    expect(r.changes).toEqual([]);
  });

  it('avisa las medidas que no encuentran su SKU', () => {
    const r = planContentUpdate(
      current,
      {
        measures: [
          { sku: 'ZZZ-9', measure: 'STD' },
          { sku: null, measure: '0.25 mm' },
        ],
      },
      'REPLACE',
      { publication: true },
    );
    expect(r.changes).toEqual([]);
    expect(r.warnings).toEqual([
      'El SKU ZZZ-9 no está en el producto: esa medida no se carga.',
      '«0.25 mm» no dice a qué SKU corresponde: esa medida no se carga.',
    ]);
  });

  it('una medida sin SKU vale si el producto tiene una sola variante', () => {
    const one = { ...empty, measures: [{ id: 'v1', sku: null, measure: null }] };
    const r = planContentUpdate(one, { measures: [{ sku: null, measure: 'STD' }] }, 'FILL_EMPTY', {
      publication: true,
    });
    expect(r.changes[0].after).toEqual([{ id: 'v1', sku: null, measure: 'STD' }]);
  });
});

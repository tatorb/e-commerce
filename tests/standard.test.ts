import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_RULES,
  describeCheck,
  isUnambiguousMeasure,
  readParams,
  scoreBand,
  scorePublication,
  type RuleConfig,
  type ScoreInput,
} from '@/domain/standard';

const rules: RuleConfig[] = SUGGESTED_RULES.map((r, i) => ({ ...r, id: `r${i}` }));

function input(over: {
  product?: Partial<ScoreInput['product']>;
  publication?: Partial<ScoreInput['publication']>;
  measurement?: ScoreInput['measurement'];
} = {}): ScoreInput {
  return {
    product: {
      warranty: null,
      kitContents: null,
      partNumber: null,
      specs: [],
      variants: [],
      compatibilities: [],
      assets: [],
      ...over.product,
    },
    publication: { title: null, description: null, attributes: [], ...over.publication },
    measurement: over.measurement ?? null,
  };
}

const takenAt = new Date('2026-10-15T00:00:00Z');
const result = (input: ScoreInput, name: string) => scorePublication(rules, input).results.find((r) => r.name === name)!;

describe('medidas sin ambigüedad', () => {
  it.each(['STD', 'std', 'Estándar', '0,50 mm', '0.50mm', '1 mm', '0.020 pulg', '0,020 pulgadas', '+1 mm', '0.25"'])(
    '%s pasa',
    (m) => expect(isUnambiguousMeasure(m)).toBe(true),
  );
  it.each(['0.5', '050', '+1', '0,25', 'medida 1', ''])('%s no pasa', (m) => expect(isUnambiguousMeasure(m)).toBe(false));

  it('no aplica con una sola variante sin medida', () => {
    expect(result(input({ product: { variants: [{ measure: null }] } }), 'Medidas sin ambigüedad').status).toBe('na');
  });
  it('falla con varias variantes sin medida', () => {
    const r = result(input({ product: { variants: [{ measure: null }, { measure: null }] } }), 'Medidas sin ambigüedad');
    expect(r).toMatchObject({ status: 'fail', detail: 'Tiene 2 variantes y ninguna medida declarada.' });
  });
  it('dice cuáles medidas no tienen unidad', () => {
    const r = result(
      input({ product: { variants: [{ measure: 'STD' }, { measure: '050' }, { measure: null }] } }),
      'Medidas sin ambigüedad',
    );
    expect(r.status).toBe('fail');
    expect(r.detail).toContain('Medidas sin unidad: 050.');
    expect(r.detail).toContain('Una variante no tiene medida.');
  });
});

describe('fotos y video', () => {
  it('usa las fotos de la ficha si hay', () => {
    const photos = Array.from({ length: 6 }, () => ({ kind: 'PHOTO' as const }));
    expect(result(input({ product: { assets: photos } }), 'Mínimo 6 fotos').status).toBe('pass');
  });
  it('si la ficha no tiene fotos, usa la medición y lo aclara', () => {
    const r = result(input({ measurement: { takenAt, metrics: { photo_count: 4 } } }), 'Mínimo 6 fotos');
    expect(r).toMatchObject({
      status: 'fail',
      fromMeasurement: true,
      detail: 'Tiene 4 de 6 fotos, según la medición del 15/10/2026.',
    });
  });
  it('sin ficha ni medición, falla', () => {
    expect(result(input(), 'Mínimo 6 fotos')).toMatchObject({ status: 'fail', detail: 'No tiene fotos cargadas.' });
  });
  it('video desde la medición', () => {
    expect(result(input({ measurement: { takenAt, metrics: { has_video: true } } }), 'Video presente').status).toBe('pass');
  });
});

describe('compatibilidades', () => {
  it('pide marca, modelo y motor en cada fila', () => {
    const r = result(
      input({ product: { compatibilities: [{ vehicleBrand: 'Ford', model: null, engine: '1.6 8v' }] } }),
      'Compatibilidades completas',
    );
    expect(r).toMatchObject({ status: 'fail', detail: 'Falta el modelo en las compatibilidades.' });
  });
  it('arma bien la lista de lo que falta', () => {
    const r = result(
      input({ product: { compatibilities: [{ vehicleBrand: 'Ford', model: null, engine: null }] } }),
      'Compatibilidades completas',
    );
    expect(r.detail).toBe('Falta el modelo y el motor en las compatibilidades.');
  });
  it('pasa con todas completas', () => {
    const r = result(
      input({ product: { compatibilities: [{ vehicleBrand: 'Ford', model: 'Fiesta', engine: '1.6 8v' }] } }),
      'Compatibilidades completas',
    );
    expect(r.status).toBe('pass');
  });
});

describe('puntaje', () => {
  it('suma los pesos de lo que pasa sobre lo que aplica', () => {
    // Pasan garantía (10) y kit (10). No aplica medidas (15). Total aplicable 85.
    const s = scorePublication(rules, input({ product: { warranty: '30 días', kitContents: 'Trae todo' } }));
    expect(s.score).toBe(Math.round((20 / 85) * 100));
    expect(s.missing.map((m) => m.name)).toEqual([
      'Mínimo 6 fotos',
      'Compatibilidades completas',
      'Ficha técnica completa',
      'Video presente',
    ]);
  });

  it('las reglas apagadas no cuentan', () => {
    const off = rules.map((r) => (r.name === 'Mínimo 6 fotos' ? { ...r, active: false } : r));
    const s = scorePublication(off, input());
    expect(s.results.some((r) => r.name === 'Mínimo 6 fotos')).toBe(false);
  });

  it('sin reglas que apliquen, no hay puntaje', () => {
    expect(scorePublication([], input()).score).toBeNull();
    expect(scoreBand(null)).toBe('none');
    expect([scoreBand(49), scoreBand(50), scoreBand(79), scoreBand(80)]).toEqual(['low', 'mid', 'mid', 'high']);
  });

  it('los valores de una regla se acotan y tienen valor de fábrica', () => {
    expect(readParams('min_photos', { min: 999 })).toEqual({ min: 30 });
    expect(readParams('min_photos', null)).toEqual({ min: 6 });
    expect(describeCheck('title_length', {})).toBe('Largo del título · mínimo de caracteres 45 · máximo de caracteres 60');
  });
});

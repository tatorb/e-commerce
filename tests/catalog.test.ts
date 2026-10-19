import { describe, expect, it } from 'vitest';
import {
  encodeFamily,
  familyOptions,
  filterPublications,
  isFiltered,
  parsePublicationSearch,
  type Filterable,
} from '@/lib/queries/catalog-filters';

// Datos inventados.

const base: Filterable & { id: string } = {
  id: '',
  title: '',
  externalId: null,
  skus: [],
  score: 50,
  stage: 'IMPORTED',
  channelStatus: 'ACTIVE',
  pipelineStatus: 'UNTOUCHED',
  family: null,
  kind: 'INDIVIDUAL',
  visits: null,
  sales: null,
  titleLock: { locked: null, source: null },
};

const items = [
  { ...base, id: 'a', title: 'Kit embrague', family: 'Kit de embrague', visits: 0, sales: 0, titleLock: { locked: false, source: 'data' as const } },
  { ...base, id: 'b', title: 'Pistones', family: 'Subconjunto (pistones + aros)', visits: 30, sales: 2, titleLock: { locked: true, source: 'data' as const }, pipelineStatus: 'IN_PIPELINE' as const },
  { ...base, id: 'c', title: 'Juntas', family: 'Juntas, varias', visits: 120, sales: null, stage: 'APPROVED' as const, kind: 'COMBO' as const },
  { ...base, id: 'd', title: 'Sin datos' },
];

const ids = (search: Parameters<typeof parsePublicationSearch>[0]) =>
  filterPublications(items, parsePublicationSearch(search)).map((p) => p.id);

describe('filtros del Catálogo', () => {
  it('por estado en el pipeline', () => {
    expect(ids({ pipeline: 'IN_PIPELINE' })).toEqual(['b']);
    expect(ids({ pipeline: 'UNTOUCHED,DISCARDED' }).sort()).toEqual(['a', 'c', 'd']);
  });

  it('individuales o combos', () => {
    expect(ids({ tipo: 'combo' })).toEqual(['c']);
    expect(ids({ tipo: 'individual' }).sort()).toEqual(['a', 'b', 'd']);
    expect(ids({ tipo: 'individual,combo' })).toHaveLength(4);
    expect(ids({ tipo: 'otro' })).toHaveLength(4);
    expect(isFiltered(parsePublicationSearch({ tipo: 'combo' }))).toBe(true);
  });

  it('por familia, aunque tenga comas', () => {
    expect(ids({ familia: encodeFamily('Juntas, varias') })).toEqual(['c']);
    expect(ids({ familia: [encodeFamily('Kit de embrague'), encodeFamily('Juntas, varias')].join(',') }).sort()).toEqual(['a', 'c']);
  });

  it('por rango de visitas, con "sin dato" aparte', () => {
    expect(ids({ visitas: '0' })).toEqual(['a']);
    expect(ids({ visitas: '1-49' })).toEqual(['b']);
    expect(ids({ visitas: '100' })).toEqual(['c']);
    expect(ids({ visitas: 'sin-dato' })).toEqual(['d']);
  });

  it('por ventas y por título bloqueado', () => {
    expect(ids({ ventas: 'con' })).toEqual(['b']);
    expect(ids({ ventas: 'sin' })).toEqual(['a']);
    expect(ids({ ventas: 'sin-dato' }).sort()).toEqual(['c', 'd']);
    expect(ids({ bloqueado: 'si' })).toEqual(['b']);
    expect(ids({ bloqueado: 'no' })).toEqual(['a']);
  });

  it('el atajo de propuestas para aplicar', () => {
    expect(ids({ propuesta: 'aplicar' })).toEqual(['c']);
    expect(isFiltered(parsePublicationSearch({ propuesta: 'aplicar' }))).toBe(true);
  });

  it('ignora valores que no conoce, como la etapa vieja', () => {
    const f = parsePublicationSearch({ pipeline: 'OTRO', visitas: 'mucho', propuesta: 'x', etapa: 'APPROVED' } as never);
    expect(isFiltered(f)).toBe(false);
  });

  it('ordena por ventas', () => {
    expect(ids({ orden: 'ventas' })).toEqual(['b', 'a', 'c', 'd']);
  });

  it('las familias, de la más común a la menos', () => {
    const opts = familyOptions([{ family: 'B' }, { family: 'A' }, { family: 'B' }, { family: null }]);
    expect(opts.map((o) => o.label)).toEqual(['B · 2', 'A · 1']);
  });
});

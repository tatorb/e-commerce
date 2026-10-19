import { describe, expect, it } from 'vitest';
import { buildProposalRequest, toDraft, type ProposalInput, type ProposalOutput } from '@/ai/proposal';
import { findPlaceholders, toProposalFields } from '@/domain/proposals';
import type { ContentSnapshot } from '@/domain/content';

// Datos inventados.
const content: ContentSnapshot = {
  title: 'Kit Prueba Marca A Modelo 1 1.6',
  description: null,
  brand: 'Marca X',
  partNumber: null,
  productType: 'Kit de prueba',
  engineSystem: null,
  line: null,
  origin: null,
  warranty: null,
  kitContents: null,
  notes: null,
  measures: [
    { id: 'v1', sku: 'ABC-1', measure: 'STD' },
    { id: 'v2', sku: 'ABC-2', measure: '0.5' },
  ],
  specs: [],
  compatibilities: [{ vehicleBrand: 'Marca A', model: null, engine: null, yearFrom: null, yearTo: null, note: null }],
  photos: [],
  videos: [],
};

const input: ProposalInput = {
  accountName: 'Cuenta de prueba',
  channel: { name: 'Canal de prueba', titleMaxLength: 60 },
  rules: [{ name: 'Garantía declarada', description: null, checks: 'Garantía declarada', weight: 10 }],
  missing: [{ name: 'Garantía declarada', detail: null }],
  productName: 'Kit de prueba',
  content,
  combo: null,
  otherPublications: [],
  listing: { photoCount: 4, hasVideo: false, channelQuality: 0.5, channelGoals: 'Sumar fotos' },
};

const empty = { value: '', reason: '', toConfirm: [] };
const output: ProposalOutput = {
  summary: ' Ordena el título y suma compatibilidades. ',
  title: { value: 'Kit Prueba Marca A Modelo 1 1.6 Medidas STD y 0,50 mm Repuesto Completo', reason: 'Más claro.', toConfirm: [] },
  description: { value: 'Kit de prueba.\nGarantía\n- [A CONFIRMAR: garantía]', reason: 'No tenía.', toConfirm: ['Garantía'] },
  brand: { value: 'Marca X', reason: '', toConfirm: [] },
  partNumber: empty,
  kitContents: empty,
  warranty: { value: '', reason: '', toConfirm: ['Plazo de garantía'] },
  measures: { items: [{ sku: 'ABC-2', measure: '0,50 mm' }, { sku: 'ZZZ', measure: 'STD' }, { sku: '', measure: '' }], reason: 'Unidad.', toConfirm: ['Que sea mm'] },
  specs: { items: [{ name: ' Material ', value: 'acero' }, { name: '', value: 'x' }], reason: 'Ficha.', toConfirm: [] },
  compatibilities: {
    items: [
      { vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: 1800, yearTo: 0, note: '' },
      { vehicleBrand: '', model: '', engine: '', yearFrom: 0, yearTo: 0, note: '' },
    ],
    reason: 'Del título.',
    toConfirm: ['Años'],
  },
};

describe('pedido a la IA', () => {
  it('usa el modelo, la caché, el esfuerzo y el reintento ante rechazos', () => {
    const r = buildProposalRequest(input);
    expect(r.model).toBe('claude-opus-5-5');
    expect(r.output_config.effort).toBe('medium');
    expect(r.output_config.format.type).toBe('json_schema');
    expect(r.fallbacks).toBe('default');
    expect(r.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(r.system[0]).not.toHaveProperty('cache_control');
    expect(r.system[1].cache_control).toEqual({ type: 'ephemeral' });
    // Las instrucciones fijas no cambian entre publicaciones.
    const other = buildProposalRequest({ ...input, content: { ...content, title: 'Otro' } });
    expect(other.system).toEqual(r.system);
  });

  it('la forma de la respuesta no tiene campos "null o valor" ni opcionales', () => {
    // La API rechaza el pedido si hay demasiados campos de ese tipo.
    const schema = JSON.stringify(buildProposalRequest(input).output_config.format.schema);
    expect(schema).not.toContain('"anyOf"');
    expect(schema).not.toMatch(/"type":\[/);
    const objects = [...schema.matchAll(/"properties":\{/g)].length;
    const required = [...schema.matchAll(/"required":\[/g)].length;
    expect(required).toBe(objects);
  });

  it('manda si es combo, qué lo forma y las otras publicaciones del producto', () => {
    const individual = buildProposalRequest(input).messages[0].content;
    expect(individual).toContain('"individual_o_combo": "Individual"');
    expect(individual).not.toContain('productos_del_combo');

    const combo = buildProposalRequest({
      ...input,
      combo: [{ name: 'Disco de prueba', quantity: 2, brand: 'Marca D', partNumber: 'D-1' }],
      otherPublications: [{ store: 'TIENDA 2', title: 'Kit de prueba Modelo 2' }],
    });
    const body = combo.messages[0].content;
    expect(body).toContain('"individual_o_combo": "Combo"');
    expect(body).toContain('"nombre": "Disco de prueba"');
    expect(body).toContain('"cantidad": 2');
    expect(body).toContain('Kit de prueba Modelo 2');
    // Las instrucciones explican la ficha compartida y los combos, y siguen fijas.
    expect(combo.system).toEqual(buildProposalRequest(input).system);
    expect(combo.system[0].text).toContain('no saques filas solo porque no aparecen en el título');
  });

  it('no manda IDs internos', () => {
    const body = JSON.stringify(buildProposalRequest(input).messages);
    expect(body).not.toContain('"v1"');
    expect(body).toContain('ABC-2');
  });
});

describe('respuesta de la IA', () => {
  it('se traduce a campos de la app y descarta lo vacío o inválido', () => {
    const draft = toDraft(output);
    expect(draft.summary).toBe('Ordena el título y suma compatibilidades.');
    expect(draft.content.partNumber).toBeUndefined();
    expect(draft.content.specs).toEqual([{ name: 'Material', value: 'acero' }]);
    expect(draft.content.compatibilities).toEqual([
      { vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: null, yearTo: null, note: null },
    ]);
    expect(draft.notes.warranty).toEqual({ reason: '', toConfirm: ['Plazo de garantía'] });
  });

  it('deja solo lo que cambia, con marcas a confirmar y el largo del título', () => {
    const { fields, notes } = toProposalFields(content, toDraft(output), { titleMaxLength: 60 });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f]));
    // La marca es igual a la de hoy: no es un cambio.
    expect(Object.keys(byField).sort()).toEqual(['compatibilities', 'description', 'measures', 'specs', 'title']);
    expect(byField.description.placeholders).toEqual(['garantía']);
    expect(byField.title.toConfirm.at(-1)).toMatch(/caracteres y el máximo del canal es 60/);
    expect(byField.measures.after).toEqual([
      { id: 'v1', sku: 'ABC-1', measure: 'STD' },
      { id: 'v2', sku: 'ABC-2', measure: '0,50 mm' },
    ]);
    expect(byField.measures.toConfirm).toEqual(['Que sea mm']);
    expect(notes).toEqual([
      'El SKU ZZZ no está en el producto: esa medida no se carga.',
      'Garantía, a confirmar: Plazo de garantía',
    ]);
  });

  it('encuentra las marcas a confirmar en textos y listas', () => {
    expect(findPlaceholders(['a [A CONFIRMAR: años] b', { x: '[a confirmar motor]' }, '[A CONFIRMAR]'])).toEqual([
      'años',
      'motor',
      'dato',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { getChannelAdapter } from '@/channels';
import type { ContentField, ContentSnapshot } from '@/domain/content';
import { ApplicationError, resolveAppliedAt, todayIn } from '@/domain/applications';

// Datos inventados.
const content: ContentSnapshot = {
  title: 'Kit de prueba Marca A Modelo 1',
  description: 'Kit de prueba.\nGarantía 6 meses.',
  brand: 'Marca X',
  partNumber: 'PZ-1',
  productType: null,
  engineSystem: null,
  line: null,
  origin: null,
  warranty: '6 meses',
  kitContents: null,
  notes: null,
  measures: [{ id: 'v1', sku: 'ABC-1', measure: 'STD' }],
  specs: [
    { name: 'Material', value: 'acero' },
    { name: 'Diámetro', value: '82 mm' },
  ],
  compatibilities: [{ vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6', yearFrom: 1995, yearTo: 2012, note: null }],
  photos: [],
  videos: [],
};

describe('guía para aplicar', () => {
  it('Mercado Libre: en el orden del formulario, con cada dato por separado', () => {
    const changed = new Set<ContentField>(['title', 'specs', 'compatibilities']);
    const guide = getChannelAdapter('MERCADOLIBRE').applyGuide(content, changed);
    expect(guide.map((s) => s.title)).toEqual([
      'Título',
      'Características',
      'Compatibilidades',
      'Descripción',
      'Garantía',
      'Medidas por SKU',
    ]);
    const characteristics = guide[1].items;
    expect(characteristics.map((i) => [i.label, i.value, i.changed])).toEqual([
      ['Marca', 'Marca X', false],
      ['Número de pieza', 'PZ-1', false],
      ['Material', 'acero', true],
      ['Diámetro', '82 mm', true],
    ]);
    expect(guide[2].items[0]).toMatchObject({ kind: 'check', value: 'Marca A Modelo 1 1.6 · 1995 a 2012', changed: true });
    expect(guide[0].items[0].changed).toBe(true);
    expect(guide[3].items[0]).toMatchObject({ changed: false, multiline: true });
  });

  it('otros canales: un dato por campo, en el orden de la ficha', () => {
    const guide = getChannelAdapter('WEB_STORE', 'Tienda web').applyGuide(content, new Set(['warranty']));
    expect(guide[0].title).toBe('Título');
    expect(guide.find((s) => s.title === 'Garantía')?.items[0].changed).toBe(true);
    expect(guide.find((s) => s.title === 'Ficha técnica')?.items[0].value).toBe('Material: acero\nDiámetro: 82 mm');
  });
});

describe('fecha de aplicación', () => {
  const timeZone = 'America/Argentina/Buenos_Aires';
  const now = new Date('2026-10-17T15:00:00Z'); // 12:00 en Buenos Aires
  const approvedAt = new Date('2026-10-15T13:00:00Z');

  it('hoy es ahora; un día anterior es el final de ese día en la zona de la cuenta', () => {
    expect(todayIn(timeZone, now)).toBe('2026-10-17');
    expect(resolveAppliedAt('2026-10-17', { timeZone, approvedAt, now })).toEqual(now);
    expect(resolveAppliedAt('2026-10-16', { timeZone, approvedAt, now }).toISOString()).toBe('2026-10-17T02:59:00.000Z');
  });

  it('no acepta fechas futuras, anteriores a la aprobación ni mal escritas', () => {
    expect(() => resolveAppliedAt('2026-10-18', { timeZone, approvedAt, now })).toThrow(ApplicationError);
    expect(() => resolveAppliedAt('2026-10-14', { timeZone, approvedAt, now })).toThrow('anterior a la aprobación');
    expect(() => resolveAppliedAt('17/10/2026', { timeZone, approvedAt, now })).toThrow('no es válida');
  });
});

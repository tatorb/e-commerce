import { describe, expect, it } from 'vitest';
import { applyQuantities, channelQuantities, parseQuantities, QuantityError, quantityKey, quantityText, sameQuantities, totalQuantity } from '@/domain/quantities';
import { fingerprint } from '@/domain/channel-sync';

// Las cantidades disponibles de una publicación. Datos inventados.

describe('cantidades', () => {
  it('del canal: una sola sin medidas, o una por medida', () => {
    expect(channelQuantities(7, [])).toEqual([{ key: '', label: '', quantity: 7 }]);
    expect(channelQuantities(null, [])).toBeNull();
    const lines = channelQuantities(5, [
      { sku: 'AROS-STD', measure: 'STD', quantity: 3 },
      { sku: 'AROS-050', measure: '0.50', quantity: 2 },
      { sku: null, measure: null, quantity: 0 },
    ])!;
    expect(lines.map((l) => [l.key, l.label, l.quantity])).toEqual([
      ['sku:AROS-STD medida:std', 'STD', 3],
      ['sku:AROS-050 medida:0.50', '0.50', 2],
      ['#3', 'Variante 3', 0],
    ]);
    expect(quantityKey({ sku: null, measure: null }, 0)).toBe('#1');
    // Si falta la de una medida, no se sabe.
    expect(channelQuantities(5, [{ sku: 'A', measure: null, quantity: 3 }, { sku: 'B', measure: null }])).toBeNull();
    expect(totalQuantity(lines)).toBe(5);
    expect(quantityText(lines)).toBe('STD: 3 · 0.50: 2 · Variante 3: 0');
    expect(quantityText(channelQuantities(7, []))).toBe('7');
  });

  it('cambiar: la misma en todas, o la de cada medida', () => {
    const base = channelQuantities(5, [
      { sku: 'A', measure: 'STD', quantity: 3 },
      { sku: 'B', measure: '0.50', quantity: 2 },
    ])!;
    expect(applyQuantities(base, { all: 10 }).map((l) => l.quantity)).toEqual([10, 10]);
    expect(applyQuantities(base, { byKey: { 'sku:B medida:0.50': 0 } }).map((l) => l.quantity)).toEqual([3, 0]);
    expect(() => applyQuantities(base, { all: -1 })).toThrow(QuantityError);
    expect(() => applyQuantities(base, { all: 1.5 })).toThrow(QuantityError);
    expect(() => applyQuantities(base, { byKey: { otra: 1 } })).toThrow('Las medidas cambiaron');
  });

  it('se comparan sin fijarse en el orden ni en los nombres, y sin cambios la app sigue al canal', () => {
    const a = [
      { key: 'x', label: 'STD', quantity: 3 },
      { key: 'y', label: '0.50', quantity: 2 },
    ];
    const b = [
      { key: 'y', label: 'otra', quantity: 2 },
      { key: 'x', label: '', quantity: 3 },
    ];
    expect(sameQuantities(a, b)).toBe(true);
    expect(fingerprint('quantity', a)).toBe(fingerprint('quantity', b));
    expect(fingerprint('quantity', null)).toBe(fingerprint('photos', null));
    expect(parseQuantities(a)).toEqual(a);
    expect(parseQuantities([])).toBeNull();
    expect(parseQuantities([{ key: 'x', quantity: -2 }])).toBeNull();
  });
});

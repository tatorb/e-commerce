import { describe, expect, it } from 'vitest';
import { costGroups, costOf, highestCost, measuresText } from '@/domain/costs';

// Costos inventados.

describe('el costo de cada medida', () => {
  it('el suyo, o el general del producto si todavía no se cargó por medida', () => {
    const costs = new Map([['std', 100]]);
    expect(costOf(costs, 90, 'std')).toBe(100);
    expect(costOf(costs, 90, '050')).toBe(90);
    expect(costOf(costs, null, '050')).toBeNull();
  });

  it('para un precio de varias medidas, el más alto; si falta uno, no hay', () => {
    expect(highestCost([100, 120.5, 110])).toBe(120.5);
    expect(highestCost([100, null])).toBeNull();
    expect(highestCost([])).toBeNull();
  });

  it('agrupa por costo al centavo, en el orden en que vienen: cada grupo es una pestaña', () => {
    const groups = costGroups([
      { m: 'STD', cost: 100 },
      { m: '0.75', cost: 120.5 },
      { m: '0.50', cost: 100.001 },
      { m: '1.00', cost: null },
      { m: '0.25', cost: null },
    ]);
    expect(groups.map((g) => [g.cost, g.items.map((i) => i.m)])).toEqual([
      [100, ['STD', '0.50']],
      [120.5, ['0.75']],
      [null, ['1.00', '0.25']],
    ]);
  });

  it('nombra las medidas como se leen', () => {
    expect(measuresText([])).toBe('');
    expect(measuresText(['STD'])).toBe('STD');
    expect(measuresText(['STD', '0.50'])).toBe('STD y 0.50');
    expect(measuresText(['STD', '0.25', '0.50'])).toBe('STD, 0.25 y 0.50');
  });
});

import { describe, expect, it } from 'vitest';
import { amountChange, countChange, pointsChange, weeklyVisits } from '@/domain/performance';
import { parsePeriod, previousPeriod } from '@/domain/sales';

// Rendimiento: el cambio contra el período anterior y las visitas por semana. Datos inventados.

describe('contra el período anterior', () => {
  it('visitas y ventas en %, con flecha para arriba o para abajo', () => {
    expect(countChange(120, 100)).toEqual({ dir: 'up', text: '20 %' });
    expect(countChange(75, 100)).toEqual({ dir: 'down', text: '25 %' });
    expect(countChange(100, 100)).toEqual({ dir: 'same', text: 'igual' });
    expect(countChange(5, 0)).toEqual({ dir: 'up', text: 'desde 0' });
    expect(countChange(0, 0)).toEqual({ dir: 'same', text: 'igual' });
    // Sin las visitas del período anterior, no se compara.
    expect(countChange(50, null)).toBeNull();
    expect(countChange(null, 10)).toBeNull();
  });

  it('la conversión en puntos', () => {
    expect(pointsChange(2.9, 2.1)).toEqual({ dir: 'up', text: '0,8 puntos' });
    expect(pointsChange(1, 2)).toEqual({ dir: 'down', text: '1 punto' });
    expect(pointsChange(3.5, 3.5)).toEqual({ dir: 'same', text: 'igual' });
    expect(pointsChange(null, 2)).toBeNull();
  });
});

describe('las visitas de las últimas 8 semanas', () => {
  it('suma cada semana de 7 días hasta hoy, y deja sin dato las semanas sin días leídos', () => {
    const now = new Date('2026-11-13T15:00:00Z');
    const days: { day: string; visits: number }[] = [];
    // Leídas solo las últimas 3 semanas: 2 visitas por día.
    for (let i = 0; i < 21; i++) days.push({ day: new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10), visits: 2 });
    const weeks = weeklyVisits(days, now);
    expect(weeks).toHaveLength(8);
    expect(weeks.map((w) => w.visits)).toEqual([null, null, null, null, null, 14, 14, 14]);
    expect(weeks[7].from).toBe('2026-11-07');
  });

  it('el cambio de un importe se mide contra el valor absoluto del anterior', () => {
    expect(amountChange(150, 100)).toEqual({ dir: 'up', text: '50 %' });
    expect(amountChange(50, 100)).toEqual({ dir: 'down', text: '50 %' });
    // De perder 100 a ganar 100 es subir.
    expect(amountChange(100, -100)).toEqual({ dir: 'up', text: '200 %' });
    expect(amountChange(-50, 0)).toEqual({ dir: 'down', text: 'desde 0' });
    expect(amountChange(0, 0)).toEqual({ dir: 'same', text: 'igual' });
    expect(amountChange(null, 10)).toBeNull();
  });

  it('el período anterior: los mismos días justo antes, o el mes de antes', () => {
    const tz = 'America/Argentina/Buenos_Aires';
    const now = new Date('2026-11-21T15:00:00Z');
    const before = (search: { periodo?: string; desde?: string; hasta?: string }) => {
      const p = previousPeriod(parsePeriod(search, now, tz), tz);
      return [p.fromDay, p.toDay];
    };
    expect(before({ periodo: '7d' })).toEqual(['2026-11-08', '2026-11-14']);
    expect(before({ periodo: '30d' })).toEqual(['2026-09-23', '2026-10-22']);
    expect(before({ periodo: 'hoy' })).toEqual(['2026-11-20', '2026-11-20']);
    // Este mes va contra los mismos días del mes pasado.
    expect(before({ periodo: 'mes' })).toEqual(['2026-10-01', '2026-10-21']);
    expect(before({ periodo: 'mes-pasado' })).toEqual(['2026-09-01', '2026-09-30']);
    expect(before({ desde: '2026-11-10', hasta: '2026-11-12' })).toEqual(['2026-11-07', '2026-11-09']);
    const p = previousPeriod(parsePeriod({ periodo: '7d' }, now, tz), tz);
    expect(p.label).toBe('Del 08/11/2026 al 14/11/2026');
    expect(p.to.toISOString()).toBe('2026-11-15T03:00:00.000Z');
  });
});

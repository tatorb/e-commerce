import { describe, expect, it } from 'vitest';
import { countChange, pointsChange, weeklyVisits } from '@/domain/performance';

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
});

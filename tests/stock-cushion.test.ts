import { describe, expect, it } from 'vitest';
import { alarmLevel, cushionShown, cushionText, owedText, saleAlarm } from '@/domain/stock-cushion';

// "Mostrar más de 5": lo que muestran los canales con poco stock y qué alarma dispara cada venta.

const out = { outSince: new Date('2026-10-28T12:00:00Z'), cutAt: null };
const none = { outSince: null, cutAt: null };

describe('mostrar más de 5', () => {
  it('lo que se muestra según el stock real', () => {
    // Sin la opción, lo que hay.
    expect([7, 3, 0, -1].map((r) => cushionShown(r, false, out))).toEqual([7, 3, 0, 0]);
    // Con la opción: de 1 a 5 se ve 6; de 6 para arriba, lo que hay.
    expect([1, 3, 5, 6, 9].map((r) => cushionShown(r, true, none))).toEqual([6, 6, 6, 6, 9]);
    // En 0 por una venta, y con una vendida sin tener, sigue en 6; la segunda sin tener ya no.
    expect([0, -1, -2, -3].map((r) => cushionShown(r, true, out))).toEqual([6, 6, 0, 0]);
    // En 0 sin una venta (cargado a mano), o pausada por no reponer: 0.
    expect(cushionShown(0, true, none)).toBe(0);
    expect(cushionShown(-1, true, { ...out, cutAt: new Date() })).toBe(0);
  });

  it('la alarma de cada venta', () => {
    expect(saleAlarm(5, 2)).toBeNull();
    expect(saleAlarm(2, 1)).toBe('low');
    expect(saleAlarm(1, 0)).toBe('out');
    expect(saleAlarm(3, 0)).toBe('out');
    expect(saleAlarm(0, -1)).toBe('short');
    expect(saleAlarm(-1, -2)).toBe('limit');
    expect(saleAlarm(1, -3)).toBe('limit');
    // Una cancelación suma: no dispara nada.
    expect(saleAlarm(0, 1)).toBeNull();
    expect([alarmLevel(3, none), alarmLevel(1, none), alarmLevel(0, out), alarmLevel(-1, { ...out, cutAt: new Date() })]).toEqual(['ok', 'low', 'out', 'cut']);
  });

  it('en palabras', () => {
    expect(cushionText(2, 6)).toBe('Hay 2 · Se ve 6');
    expect(cushionText(8, 8)).toBe('Hay 8');
    expect(cushionText(-1, 6)).toBe('Hay 0 · Se ve 6');
    expect([owedText(1), owedText(2)]).toEqual(['Falta 1 para entregar', 'Faltan 2 para entregar']);
  });
});

import { describe, expect, it } from 'vitest';
import { alarmLevel, changeAlarm, cushionShown, cushionText, owedText, saleAlarm } from '@/domain/stock-cushion';

// "Mostrar más de 5": lo que muestran los canales con poco stock y qué alarma dispara cada cambio.

const out = { outSince: new Date('2026-10-28T12:00:00Z'), lowAt: null };
const low = { outSince: null, lowAt: new Date('2026-10-28T12:00:00Z') };
const none = { outSince: null, lowAt: null };

describe('mostrar más de 5', () => {
  it('lo que se muestra según el stock real: con la opción, nunca algo que pause la publicación', () => {
    // Sin la opción, lo que hay.
    expect([7, 3, 0, -1].map((r) => cushionShown(r, false))).toEqual([7, 3, 0, 0]);
    // Con la opción: con 5 o menos se ve 6, también en 0 y con ventas sin tener; de 6 para arriba, lo que hay.
    expect([5, 3, 1, 0, -1, -2, -5].map((r) => cushionShown(r, true))).toEqual([6, 6, 6, 6, 6, 6, 6]);
    expect([6, 9].map((r) => cushionShown(r, true))).toEqual([6, 9]);
  });

  it('la alarma de cada venta', () => {
    expect(saleAlarm(5, 2)).toBeNull();
    expect(saleAlarm(2, 1)).toBe('low');
    expect(saleAlarm(1, 0)).toBe('out');
    expect(saleAlarm(3, 0)).toBe('out');
    expect(saleAlarm(0, -1)).toBe('short');
    expect(saleAlarm(-1, -3)).toBe('short');
    // Una cancelación suma: no dispara nada.
    expect(saleAlarm(0, 1)).toBeNull();
    expect([alarmLevel(3, none), alarmLevel(1, none), alarmLevel(0, none), alarmLevel(-1, out)]).toEqual(['ok', 'low', 'out', 'out']);
  });

  it('la alarma de un ajuste o una carga: al entrar en 1 o en 0, una sola vez', () => {
    expect(changeAlarm(0, none)).toBe('out');
    expect(changeAlarm(0, low)).toBe('out');
    expect(changeAlarm(-1, none)).toBe('out');
    // Ya estaba sin stock: no se repite.
    expect(changeAlarm(0, out)).toBeNull();
    expect(changeAlarm(1, none)).toBe('low');
    // Volvió de 0 a 1: avisa que queda 1.
    expect(changeAlarm(1, out)).toBe('low');
    expect(changeAlarm(1, low)).toBeNull();
    expect(changeAlarm(2, none)).toBeNull();
  });

  it('en palabras', () => {
    expect(cushionText(2, 6)).toBe('Hay 2 · Se ve 6');
    expect(cushionText(8, 8)).toBe('Hay 8');
    expect(cushionText(-1, 6)).toBe('Hay 0 · Se ve 6');
    expect([owedText(1), owedText(2)]).toEqual(['Falta 1 para entregar', 'Faltan 2 para entregar']);
  });
});

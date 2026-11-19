import { describe, expect, it } from 'vitest';
import { getChannelAdapter } from '@/channels';
import { titleLockFromData } from '@/lib/family-lock';

// Datos inventados.

const ml = getChannelAdapter('MERCADOLIBRE');
const sold = (id: string, n: number) => ({ id, measurements: [{ metrics: { sold_visible: n, sales_90d: 0 } }] });

describe('título bloqueado por ventas', () => {
  it('una opción de venta sin ventas queda bloqueada si otra opción de la misma medida vendió', () => {
    // Es otra opción: la principal vendió.
    expect(titleLockFromData(ml, { ...sold('b', 0), mainOption: { ...sold('a', 1), saleOptions: [sold('b', 0)] } })).toBe(true);
    // Es la principal: vendió una de sus opciones.
    expect(titleLockFromData(ml, { ...sold('a', 0), saleOptions: [sold('b', 0), sold('c', 2)] })).toBe(true);
    // La vendida es una hermana: otra opción de la misma principal.
    expect(titleLockFromData(ml, { ...sold('b', 0), mainOption: { ...sold('a', 0), saleOptions: [sold('b', 0), sold('c', 1)] } })).toBe(true);
    // Ninguna vendió.
    expect(titleLockFromData(ml, { ...sold('a', 0), saleOptions: [sold('b', 0)] })).toBe(false);
    // Sola, como siempre.
    expect(titleLockFromData(ml, sold('a', 3))).toBe(true);
  });
});

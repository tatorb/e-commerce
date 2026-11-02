import { describe, expect, it } from 'vitest';
import { alarmItem, alarmItemText, alarmTaskText } from '@/lib/stock-alarms';

// Lo que dice la tarea de una alarma de stock: el producto, el SKU, la medida
// y las publicaciones que la venden, para saber qué pedir a fábrica. Datos inventados.

const variants = [
  { sku: 'SP-900-00', measure: 'STD' },
  { sku: 'SP-900-50', measure: '0.50' },
];
const row = (key: string, quantity: number, v = variants) => ({
  key,
  label: '',
  quantity,
  lowAt: null,
  outSince: quantity <= 0 ? new Date('2026-11-02T12:00:00.000Z') : null,
  remindedAt: null,
  cutAt: null,
  product: { id: 'p', name: 'Subconjunto SP-900', showMore: true, accountId: 'a', account: { timezone: 'America/Argentina/Buenos_Aires' }, variants: v },
});

describe('la tarea de una alarma de stock', () => {
  it('dice el producto, el SKU y la medida', () => {
    expect(alarmItem(row('sku:SP-900-50 medida:0.50', 0))).toEqual({ name: 'Subconjunto SP-900', sku: 'SP-900-50', measure: '0.50' });
    // Una sola medida en la ficha: la de esa.
    expect(alarmItem(row('', 0, [{ sku: 'BA-1', measure: 'STD' }]))).toEqual({ name: 'Subconjunto SP-900', sku: 'BA-1', measure: 'STD' });
    // Sin medidas ni SKU: solo el nombre.
    expect(alarmItemText(alarmItem(row('', 0, [])))).toBe('Subconjunto SP-900');
  });

  it('en el título y arriba de la descripción, con cada publicación de la medida', () => {
    const t = alarmTaskText(row('sku:SP-900-50 medida:0.50', -1) as never, 'out', [
      { title: 'Subconjunto Pistón SP-900 0.50', externalId: 'MLA9100002', channelName: 'Mercado Libre' },
    ]);
    expect(t.title).toBe('Reponer: Subconjunto SP-900 · SKU SP-900-50 · medida 0.50, falta 1 para entregar');
    expect(t.description.split('\n\n')[0]).toBe(
      ['Producto: Subconjunto SP-900', 'SKU: SP-900-50', 'Medida: 0.50', 'En Mercado Libre: Subconjunto Pistón SP-900 0.50 (MLA9100002)'].join('\n'),
    );
    expect(alarmTaskText(row('', 1, []) as never, 'low').description).toContain('SKU: sin cargar en la ficha');
  });
});

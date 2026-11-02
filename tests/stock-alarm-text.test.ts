import { describe, expect, it } from 'vitest';
import { alarmItem, alarmItemText, alarmTaskText } from '@/lib/stock-alarms';
import { linkParts, plainLinks } from '@/domain/text-links';
import { taskMail } from '@/domain/task-mail';

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
  product: { id: 'p1', name: 'Subconjunto SP-900', showMore: true, accountId: 'a', account: { timezone: 'America/Argentina/Buenos_Aires', slug: 'prueba' }, variants: v },
});

describe('la tarea de una alarma de stock', () => {
  it('dice el producto, el SKU y la medida', () => {
    expect(alarmItem(row('sku:SP-900-50 medida:0.50', 0))).toEqual({ name: 'Subconjunto SP-900', sku: 'SP-900-50', measure: '0.50' });
    // Una sola medida en la ficha: la de esa.
    expect(alarmItem(row('', 0, [{ sku: 'BA-1', measure: 'STD' }]))).toEqual({ name: 'Subconjunto SP-900', sku: 'BA-1', measure: 'STD' });
    // Sin medidas ni SKU: solo el nombre.
    expect(alarmItemText(alarmItem(row('', 0, [])))).toBe('Subconjunto SP-900');
  });

  it('en el título y arriba de la descripción, con links al producto, a la publicación y al canal', () => {
    const t = alarmTaskText(
      row('sku:SP-900-50 medida:0.50', -1) as never,
      'out',
      [{ id: 'pub9', title: 'Subconjunto Pistón SP-900 0.50', externalId: 'MLA9100002', channelName: 'Mercado Libre', url: 'https://articulo.mercadolibre.com.ar/MLA-9100002-prueba' }],
      'https://app.ejemplo.com',
    );
    expect(t.title).toBe('Reponer: Subconjunto SP-900 · SKU SP-900-50 · medida 0.50, falta 1 para entregar');
    const head = t.description.split('\n\n')[0];
    const product = 'https://app.ejemplo.com/a/prueba/productos/p1?seccion=stock';
    expect(plainLinks(head)).toBe(
      [
        `Producto: Subconjunto SP-900 (${product})`,
        `SKU: SP-900-50 (${product})`,
        'Medida: 0.50',
        'Publicación: Subconjunto Pistón SP-900 0.50 (https://app.ejemplo.com/a/prueba/publicaciones/pub9) · MLA9100002 · Ver en Mercado Libre (https://articulo.mercadolibre.com.ar/MLA-9100002-prueba)',
      ].join('\n'),
    );
    expect(linkParts(head).filter((p) => p.href).map((p) => p.text)).toEqual(['Subconjunto SP-900', 'SP-900-50', 'Subconjunto Pistón SP-900 0.50', 'Ver en Mercado Libre']);
    expect(alarmTaskText(row('', 1, []) as never, 'low', [], 'https://app.ejemplo.com').description).toContain('SKU: sin cargar en la ficha');

    // En el mail, los links son links; en el de texto, con la dirección al lado.
    const mail = taskMail({
      kind: 'ASSIGNED',
      person: 'Ana',
      account: 'Prueba',
      title: t.title,
      description: t.description,
      status: 'PENDING',
      remindAt: null,
      dueOn: null,
      people: ['Ana'],
      publications: [],
      link: 'https://app.ejemplo.com/a/prueba/tareas/1',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    expect(mail.html).toContain(`<a href="${product}" style="color:#1c1917;font-weight:600">SP-900-50</a>`);
    expect(mail.html).toContain('>Ver en Mercado Libre</a>');
    expect(mail.text).toContain(`SKU: SP-900-50 (${product})`);
  });
});

import { describe, expect, it } from 'vitest';
import { publicationFigures, type FiguresInput } from '@/lib/publication-figures';

// Precio, cantidad y ventas de cada publicación en las tarjetas del producto. Datos inventados.

const twoMeasures = { variants: [{ sku: 'AROS-00', measure: 'STD' }, { sku: 'AROS-50', measure: '0.50' }] };
const copy = (over: Partial<NonNullable<FiguresInput['channelCopy']>> = {}): NonNullable<FiguresInput['channelCopy']> => ({
  price: '1000',
  discount: null,
  quantity: 4,
  variations: [],
  details: {},
  stockInChannel: false,
  missingSince: null,
  ...over,
});
const pub = (over: Partial<FiguresInput> = {}): FiguresInput => ({ price: '1000', quantities: null, measurements: [], channelCopy: copy(), ...over });

describe('precio, cantidad y ventas de una publicación', () => {
  it('lo que hay en el canal, con el descuento y lo que falta subir', () => {
    const f = publicationFigures(pub({ price: '1200', channelCopy: copy({ discount: '10' }) }), { variants: [] }, null);
    expect(f.price).toEqual({ now: expect.stringContaining('1.000'), discount: '10 %', pending: expect.stringContaining('1.200') });
    expect(f.quantity).toEqual({ now: '4', empty: false, full: false, pending: null });
    expect(publicationFigures(pub({ channelCopy: copy({ discount: '0' }) }), { variants: [] }, null).price?.discount).toBeNull();
  });

  it('cada medida, o la medida que vende sola por su SKU', () => {
    const variations = [
      { sku: 'AROS-00', measure: 'STD', quantity: 2 },
      { sku: 'AROS-50', measure: '0.50', quantity: 0 },
    ];
    expect(publicationFigures(pub({ channelCopy: copy({ quantity: 2, variations }) }), twoMeasures, null).quantity?.now).toBe('STD: 2 · 0.50: 0');
    const sola = publicationFigures(pub({ channelCopy: copy({ quantity: 0, details: { skus: ['AROS-50'] } }) }), twoMeasures, null);
    expect(sola.quantity).toEqual({ now: '0.50: 0', empty: true, full: false, pending: null });
  });

  it('la cantidad por subir: la cambiada en la app, o la que le toca del stock', () => {
    const changed = publicationFigures(pub({ quantities: [{ key: '', label: '', quantity: 9 }] }), { variants: [] }, null);
    expect(changed.quantity?.pending).toBe('9');
    const plan = { managed: true as const, lines: [{ key: '', label: '', quantity: 3 }], channel: null, pending: true, measure: { label: 'STD', sku: 'AROS-00' } };
    const managed = publicationFigures(pub({ channelCopy: copy({ details: { skus: ['AROS-00'] } }) }), twoMeasures, plan);
    expect(managed.quantity).toEqual({ now: 'STD: 4', empty: false, full: false, pending: 'STD: 3' });
    expect(publicationFigures(pub({ channelCopy: copy({ stockInChannel: true }) }), { variants: [] }, null).quantity?.full).toBe(true);
  });

  it('sin leer del canal, lo de la app, sin nada por subir', () => {
    const f = publicationFigures(pub({ price: '500', quantities: [{ key: '', label: '', quantity: 1 }], channelCopy: null }), { variants: [] }, null);
    expect(f.price).toEqual({ now: expect.stringContaining('500'), discount: null, pending: null });
    expect(f.quantity).toEqual({ now: '1', empty: false, full: false, pending: null });
    expect(publicationFigures(pub({ price: null, channelCopy: null }), { variants: [] }, null)).toMatchObject({ price: null, quantity: null });
    // La que ya no está en el canal no muestra lo último que se leyó.
    expect(publicationFigures(pub({ price: null, channelCopy: copy({ missingSince: new Date() }) }), { variants: [] }, null).price).toBeNull();
  });

  it('las ventas: los vendidos del canal y las de 90 días, de la última medición que las tiene', () => {
    const measurements = [{ metrics: { sold_visible: 12 } }, { metrics: { sold_visible: 10, sales_90d: 3 } }];
    expect(publicationFigures(pub({ measurements }), { variants: [] }, null).sales).toEqual({ sold: 12, last90: 3 });
    expect(publicationFigures(pub(), { variants: [] }, null).sales).toEqual({ sold: null, last90: null });
  });
});

import { describe, expect, it } from 'vitest';
import { factoryPackageOf as fromItem } from '@/channels/mercadolibre/listings';
import { loadedPackage, packageText, packageTooSmall } from '@/domain/package';

// El paquete cargado contra el empaque que calcula el canal. Datos inventados.

describe('el paquete cargado y el empaque del canal', () => {
  const loaded = loadedPackage([
    { name: 'Altura del paquete del seller', value: '20 cm' },
    { name: 'Ancho del paquete del seller', value: '14 cm' },
    { name: 'Largo del paquete del seller', value: '6 cm' },
    { name: 'Peso del paquete del seller', value: '440 g' },
  ])!;

  it('lee el empaque de Mercado Libre de sus datos o de las dimensiones del envío', () => {
    expect(fromItem({ shipping: { dimensions: '23x23x10,1680' } })).toEqual({ height: 23, width: 23, length: 10, weight: 1680 });
    expect(
      fromItem({
        attributes: [
          { id: 'PACKAGE_HEIGHT', value_name: '230 mm' },
          { id: 'PACKAGE_WIDTH', value_name: '23 cm' },
          { id: 'PACKAGE_LENGTH', value_name: '10 cm' },
          { id: 'PACKAGE_WEIGHT', value_name: '1.68 kg' },
        ],
      }),
    ).toEqual({ height: 23, width: 23, length: 10, weight: 1680 });
    expect(fromItem({ shipping: {} })).toBeNull();
  });

  it('avisa cuando el cargado es más chico, girándolo si hace falta', () => {
    expect(packageText({ height: 23, width: 23, length: 10, weight: 1680 })).toBe('23 x 23 x 10 cm, 1,68 kg');
    expect(packageTooSmall(loaded, { height: 23, width: 23, length: 10, weight: 1680 })).toContain('en las medidas y el peso');
    // El mismo paquete girado entra.
    expect(packageTooSmall(loaded, { height: 6, width: 20, length: 14, weight: 400 })).toBeNull();
    expect(packageTooSmall(loaded, { height: 6, width: 20, length: 14, weight: 500 })).toContain('en el peso');
    expect(loadedPackage([{ name: 'Altura del paquete del seller', value: '20 cm' }])).toBeNull();
  });
});

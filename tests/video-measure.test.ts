import { describe, expect, it } from 'vitest';
import { measureFromName } from '@/domain/video-measure';

const M = [
  { key: 'sku:SP-449-00 medida:STD', label: 'STD', sku: 'SP-449-00' },
  { key: 'sku:SP-449-60 medida:0,60 MM', label: '0,60 mm', sku: 'SP-449-60' },
];

describe('la medida que dice el nombre del video', () => {
  it('la reconoce por el SKU, aunque los ceros no coincidan', () => {
    expect(measureFromName('SP-449-00.MP4', M)?.label).toBe('STD');
    expect(measureFromName('SP-449-060.MP4', M)?.label).toBe('0,60 mm');
    expect(measureFromName('sp 449 60 · editado.mp4', M)?.label).toBe('0,60 mm');
    expect(measureFromName('SP-449-00 · editado.mp4', M)?.label).toBe('STD');
  });

  it('sin SKU en el nombre, o con una sola medida, no adivina', () => {
    expect(measureFromName('DJI_20261117164309_0073_D.MP4', M)).toBeNull();
    expect(measureFromName('SP-449.MP4', M)).toBeNull();
    expect(measureFromName('SP-449-00.MP4', [M[0]])).toBeNull();
    // Un SKU de una sola parte aparece en cualquier nombre.
    expect(measureFromName('video 60 segundos.mp4', [{ key: 'a', label: 'A', sku: '60' }, { key: 'b', label: 'B', sku: '00' }])).toBeNull();
  });

  it('si el nombre trae dos medidas, no elige', () => {
    expect(measureFromName('SP-449-00 y SP-449-60.mp4', M)).toBeNull();
  });
});

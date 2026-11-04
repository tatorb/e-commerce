import { describe, expect, it } from 'vitest';
import { arrangedMedia, placeFixedPhotos, variantPhotos, withFixedPlaces, type PhotoRef } from '@/domain/media';

// El orden combinado: las imágenes con texto con lugar fijo le ganan al orden
// del protocolo, y las fotos del protocolo llenan los huecos. Datos de prueba.

const p = (n: number, variants?: string[]): PhotoRef => ({ kind: 'edit', editId: `P${n}`, ...(variants ? { variants } : {}) });
const t = (id: string): PhotoRef => ({ kind: 'text', id });
const names = (refs: PhotoRef[]) => refs.map((r) => (r.kind === 'edit' ? r.editId : r.kind === 'text' ? r.id : '?'));

describe('el orden combinado', () => {
  it('seis del protocolo y dos imágenes con texto en los lugares 2 y 4', () => {
    expect(withFixedPlaces(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], [{ item: 'T4', place: 4 }, { item: 'T2', place: 2 }])).toEqual(['P1', 'T2', 'P2', 'T4', 'P3', 'P4', 'P5', 'P6']);
    const list = placeFixedPhotos([1, 2, 3, 4, 5, 6].map((n) => p(n)), [{ ref: t('T2'), place: 2 }, { ref: t('T4'), place: 4 }], []);
    expect(names(list)).toEqual(['P1', 'T2', 'P2', 'T4', 'P3', 'P4', 'P5', 'P6']);
  });

  it('un lugar más allá del final va al final, y el lugar 1 se respeta', () => {
    expect(withFixedPlaces(['P1', 'P2'], [{ item: 'T', place: 8 }])).toEqual(['P1', 'P2', 'T']);
    expect(withFixedPlaces(['P1', 'P2'], [{ item: 'T', place: 1 }])).toEqual(['T', 'P1', 'P2']);
  });

  it('si ya estaba en otro lugar, se mueve al suyo', () => {
    const list = placeFixedPhotos([t('T'), p(1), p(2), p(3)], [{ ref: t('T'), place: 3 }], []);
    expect(names(list)).toEqual(['P1', 'P2', 'T', 'P3']);
  });

  it('con medidas, cada medida la ve en su lugar, aunque tenga otras fotos', () => {
    // P1 es de todas, P2 y P3 son de STD, P4 es de 0.60.
    const refs = arrangedMedia(
      [
        { ref: p(1), use: [] },
        { ref: p(2), use: ['std'] },
        { ref: p(3), use: ['std'] },
        { ref: p(4), use: ['060'] },
      ],
      ['std', '060'],
    );
    const list = placeFixedPhotos(refs, [{ ref: t('T'), place: 2 }], ['std', '060']);
    expect(names(variantPhotos(list, 'std'))).toEqual(['P1', 'T', 'P2', 'P3']);
    expect(names(variantPhotos(list, '060'))).toEqual(['P1', 'T', 'P4']);
  });
});

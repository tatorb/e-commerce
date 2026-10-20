import { describe, expect, it } from 'vitest';
import { openPhotoIds, photosHref, toggledPhotos } from '@/components/pipeline/images/open-photos';

describe('fotos abiertas en el paso Imágenes', () => {
  it('lee varias fotos de la dirección, y también el link viejo de una sola', () => {
    expect(openPhotoIds({ fotos: 'a,b,,a' })).toEqual(['a', 'b']);
    expect(openPhotoIds({ foto: 'a' })).toEqual(['a']);
    expect(openPhotoIds({ fotos: ['a', 'b,c'], foto: 'c' })).toEqual(['a', 'b', 'c']);
    expect(openPhotoIds({})).toEqual([]);
    expect(openPhotoIds({ fotos: Array.from({ length: 80 }, (_, i) => `f${i}`).join(',') })).toHaveLength(50);
  });

  it('tocar una foto la abre o la cierra, sin tocar las otras', () => {
    expect(toggledPhotos(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggledPhotos(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('arma la dirección con las fotos abiertas', () => {
    expect(photosHref('/a/x/pipeline/p?paso=imagenes', ['a', 'b'])).toBe('/a/x/pipeline/p?paso=imagenes&fotos=a,b');
    expect(photosHref('/a/x/pipeline/p?paso=imagenes', [])).toBe('/a/x/pipeline/p?paso=imagenes');
  });
});

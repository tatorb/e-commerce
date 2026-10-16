import { describe, expect, it } from 'vitest';
import { parseCompatibilities, parseLinks, parseMeasures, parseSpecs, parseYears, splitItems } from '@/importers/cells';

describe('celdas con varios datos', () => {
  it('separa por línea o por punto y coma, sin líneas vacías', () => {
    expect(splitItems('a\n\n b ;c\r\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lee la ficha técnica y avisa lo que no entiende', () => {
    const r = parseSpecs('Diámetro: 82,5 mm\nMaterial:aluminio\nsin dos puntos\nAltura:\ndiámetro: 90 mm\nRosca: M10: fina');
    expect(r.items).toEqual([
      { name: 'Diámetro', value: '82,5 mm' },
      { name: 'Material', value: 'aluminio' },
      { name: 'Rosca', value: 'M10: fina' },
    ]);
    expect(r.warnings).toEqual([
      '«sin dos puntos» no tiene la forma Nombre: valor.',
      '«Altura» no tiene valor.',
      '«diámetro» está repetido: vale el primero.',
    ]);
  });

  it('entiende las formas de escribir los años', () => {
    expect(parseYears('1995-2012')).toMatchObject({ from: 1995, to: 2012, ok: true });
    expect(parseYears('1995 a 2012')).toMatchObject({ from: 1995, to: 2012, ok: true });
    expect(parseYears('2010')).toMatchObject({ from: 2010, to: 2010, ok: true });
    expect(parseYears('2010-')).toMatchObject({ from: 2010, to: null, ok: true });
    expect(parseYears('desde 2010')).toMatchObject({ from: 2010, to: null, ok: true });
    expect(parseYears('-2012')).toMatchObject({ from: null, to: 2012, ok: true });
    expect(parseYears('')).toMatchObject({ from: null, to: null, ok: true });
    expect(parseYears('2012-1995')).toMatchObject({ from: 1995, to: 2012, ok: true, swapped: true });
    expect(parseYears('noventas').ok).toBe(false);
    expect(parseYears('1800-1850').ok).toBe(false);
  });

  it('lee compatibilidades con marca, modelo, motor y años', () => {
    const r = parseCompatibilities(
      'Marca A | Modelo 1 | 1.6 8v | 1995-2012\nMarca B | Modelo 2 | 2.0\nMarca C | Modelo 3 | 1.4 | 2012-2005\nMarca D | Modelo 4 | 1.8 | varios\nauto sin barras',
    );
    expect(r.items).toEqual([
      { vehicleBrand: 'Marca A', model: 'Modelo 1', engine: '1.6 8v', yearFrom: 1995, yearTo: 2012, note: null },
      { vehicleBrand: 'Marca B', model: 'Modelo 2', engine: '2.0', yearFrom: null, yearTo: null, note: null },
      { vehicleBrand: 'Marca C', model: 'Modelo 3', engine: '1.4', yearFrom: 2005, yearTo: 2012, note: null },
      { vehicleBrand: 'Marca D', model: 'Modelo 4', engine: '1.8', yearFrom: null, yearTo: null, note: 'varios' },
      { vehicleBrand: null, model: null, engine: null, yearFrom: null, yearTo: null, note: 'auto sin barras' },
    ]);
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toContain('al revés');
    expect(r.warnings[1]).toContain('años «varios»');
    expect(r.warnings[2]).toContain('nota');
  });

  it('lee medidas por SKU e ignora los SKU sin medida', () => {
    const r = parseMeasures('ABC-1: STD\nABC-2: 0,50 mm\nABC-3:\n0.25');
    expect(r.items).toEqual([
      { sku: 'ABC-1', measure: 'STD' },
      { sku: 'ABC-2', measure: '0,50 mm' },
      { sku: null, measure: '0.25' },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('lee links y descarta lo que no es un link', () => {
    const r = parseLinks('https://example.com/1.jpg\nhttps://example.com/2.jpg https://example.com/1.jpg\nfoto3.jpg');
    expect(r.items).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg']);
    expect(r.warnings).toEqual(['«foto3.jpg» no es un link.']);
  });
});

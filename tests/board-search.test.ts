import { describe, expect, it } from 'vitest';
import { matchesSearch, searchWords } from '@/domain/board-search';

// El buscador del tablero del Pipeline. Datos inventados.

const card = {
  title: 'Subconjunto Pistón Peugeot 405 1.9 Diésel',
  productName: 'Subconjunto SP-741',
  code: 'SP-741',
  externalId: 'MLA1234567890',
  familyCodes: ['MLA1234567890', 'MLA1234567891'],
  skus: ['SP-741-00', 'SP-741-50'],
};

describe('buscar en el tablero', () => {
  it('encuentra por SKU, código del canal, producto o título, sin mayúsculas ni acentos', () => {
    expect(matchesSearch(card, 'sp-741-50')).toBe(true);
    expect(matchesSearch(card, 'MLA1234567891')).toBe(true);
    expect(matchesSearch(card, 'subconjunto sp')).toBe(true);
    expect(matchesSearch(card, 'peugeot diesel')).toBe(true);
    expect(matchesSearch(card, 'PISTÓN 405')).toBe(true);
    expect(matchesSearch(card, 'citroen')).toBe(false);
    // Todas las palabras tienen que estar, aunque sea en datos distintos.
    expect(matchesSearch(card, 'peugeot sp-741-00')).toBe(true);
    expect(matchesSearch(card, 'peugeot renault')).toBe(false);
  });

  it('sin texto, o solo espacios, pasan todas; sin datos, no pasa ninguna', () => {
    expect(searchWords('  ')).toEqual([]);
    expect(matchesSearch(card, '   ')).toBe(true);
    expect(matchesSearch({ title: null, productName: null, code: null, externalId: null }, 'algo')).toBe(false);
  });
});

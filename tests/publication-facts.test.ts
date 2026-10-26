import { describe, expect, it } from 'vitest';
import { measuresText, publicationFacts, type FactsInput } from '@/lib/publication-facts';

// El código, las medidas y la respuesta automática de cada publicación. Datos inventados.

const product = { partNumber: 'SP-914', variants: [{ sku: 'SP-914-00', measure: 'STD' }, { sku: 'SP-914-50', measure: '0.50' }] };
const copy = (over: Partial<NonNullable<FactsInput['channelCopy']>> = {}) => ({ variations: [], details: {}, missingSince: null, ...over });
const pub = (over: Partial<FactsInput> = {}): FactsInput => ({ autoAnswer: false, externalId: 'MLA1', variantListings: [], channelCopy: copy(), ...over });
const text = (p: FactsInput, prod: Parameters<typeof publicationFacts>[1] = product) => measuresText(publicationFacts(p, prod).measures);

describe('lo de arriba de una publicación', () => {
  it('el código es el número de pieza; sin él, el SKU si hay uno solo', () => {
    expect(publicationFacts(pub(), product).code).toBe('SP-914');
    expect(publicationFacts(pub(), { partNumber: ' ', variants: [{ sku: 'AB-1', measure: null }] }).code).toBe('AB-1');
    expect(publicationFacts(pub(), { ...product, partNumber: null }).code).toBeNull();
  });

  it('las medidas: varias en la publicación, una sola por su SKU, o ninguna', () => {
    const variations = [
      { sku: 'SP-914-00', measure: 'STD', photoIds: [] },
      { sku: 'SP-914-50', measure: '0.50', photoIds: [] },
    ];
    expect(text(pub({ channelCopy: copy({ variations }) }))).toBe('2 medidas: STD y 0.50');
    expect(text(pub({ channelCopy: copy({ details: { skus: ['SP-914-50'] } }) }))).toBe('Solo la medida 0.50');
    expect(text(pub(), { partNumber: 'X', variants: [{ sku: 'X', measure: null }] })).toBe('Sin medidas');
    expect(text(pub({ variantListings: [{ externalId: 'MLA1', measure: 'STD' }, { externalId: 'MLA2', measure: '0.50' }] }))).toBe(
      '2 medidas: STD y 0.50, una publicación por medida',
    );
    // Sin publicar: se va a crear con las medidas de la ficha.
    expect(text(pub({ externalId: null, channelCopy: null }))).toBe('2 medidas: STD y 0.50');
  });

  it('la respuesta automática, como está en la publicación', () => {
    expect(publicationFacts(pub({ autoAnswer: true }), product).autoAnswer).toBe(true);
    expect(publicationFacts(pub(), product).autoAnswer).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { measuresText, publicationFacts, skuCode, type FactsInput } from '@/lib/publication-facts';

// El código, las medidas y la respuesta automática de cada publicación. Datos inventados.

const product = { partNumber: 'SP-914', variants: [{ sku: 'SP-914-00', measure: 'STD' }, { sku: 'SP-914-50', measure: '0.50' }] };
const copy = (over: Partial<NonNullable<FactsInput['channelCopy']>> = {}) => ({ variations: [], details: {}, missingSince: null, ...over });
const pub = (over: Partial<FactsInput> = {}): FactsInput => ({ autoAnswer: false, channelStatus: 'ACTIVE', externalId: 'MLA1', variantListings: [], channelCopy: copy(), ...over });
const text = (p: FactsInput, prod: Parameters<typeof publicationFacts>[1] = product) => measuresText(publicationFacts(p, prod).measures);

describe('lo de arriba de una publicación', () => {
  it('el código sale de los SKU sin la medida; sin un código común, del número de pieza', () => {
    expect(publicationFacts(pub(), { ...product, partNumber: null }).code).toBe('SP-914');
    expect(skuCode(['SP-865 050'])).toBe('SP-865');
    expect(skuCode(['R23080000-00', 'R23080000-50'])).toBe('R23080000');
    expect(skuCode(['SP-808-0.50'])).toBe('SP-808');
    // Lo que no es una medida queda: IN-497 es el código entero.
    expect(skuCode(['IN-497'])).toBe('IN-497');
    expect(skuCode(['IN-10'])).toBe('IN-10');
    expect(skuCode([])).toBeNull();
    expect(skuCode(['AROS-STD', 'AROS-050'])).toBeNull();
    expect(publicationFacts(pub(), { partNumber: 'PN-1', variants: [{ sku: 'AROS-STD', measure: 'STD' }, { sku: 'AROS-050', measure: '0.50' }] }).code).toBe('PN-1');
    expect(publicationFacts(pub(), { partNumber: null, variants: [] }).code).toBeNull();
  });

  it('el estado en el canal, como está en la publicación', () => {
    expect(publicationFacts(pub({ channelStatus: 'PAUSED' }), product).status).toBe('PAUSED');
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

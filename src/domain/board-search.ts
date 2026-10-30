// El buscador del tablero del Pipeline: encuentra una tarjeta por el SKU, el
// código en el canal, el nombre del producto o el título, sin importar
// mayúsculas ni acentos. Cada palabra que se escribe tiene que aparecer en
// alguno de esos datos. Sin la base de datos, para poder probarlo solo.

export type SearchableCard = {
  title: string | null;
  productName?: string | null;
  code: string | null;
  externalId: string | null;
  familyCodes?: string[];
  skus?: string[];
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Las palabras escritas, limpias; vacío si no hay nada que buscar. */
export function searchWords(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Si la tarjeta coincide con lo escrito: todas las palabras, en cualquiera de sus datos. */
export function matchesSearch(card: SearchableCard, query: string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const haystack = fold([card.title, card.productName, card.code, card.externalId, ...(card.familyCodes ?? []), ...(card.skus ?? [])].filter(Boolean).join(' '));
  return words.every((w) => haystack.includes(w));
}

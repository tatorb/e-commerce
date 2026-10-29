// Las cuentas del descuento frente a lo que acepta el canal: el canal informa
// entre qué precios con descuento lo acepta, y la app elige el descuento en %
// sobre el precio publicado. Los precios son para el comprador, con IVA.

/** Entre qué precios con descuento acepta el canal un descuento propio. null en un lado: no pone límite ahí. */
export type DiscountBounds = { minPrice: number | null; maxPrice: number | null; suggestedPrice: number | null };

/** El precio con descuento, como lo sube la app: en pesos enteros. */
export const dealPrice = (listPrice: number, pct: number) => Math.round(listPrice * (1 - pct / 100));

/**
 * Lo que aceptan todas juntas, si el precio va a varias publicaciones: el
 * precio con descuento tiene que entrar en el rango de cada una. null si
 * alguna no deja ponerle descuento.
 */
export function combinedBounds(list: (DiscountBounds | null)[]): DiscountBounds | null {
  if (list.length === 0 || list.some((b) => b === null)) return null;
  const all = list as DiscountBounds[];
  const pick = (values: (number | null)[], f: (...n: number[]) => number) => {
    const known = values.filter((v): v is number => v !== null);
    return known.length > 0 ? f(...known) : null;
  };
  const minPrice = pick(
    all.map((b) => b.minPrice),
    Math.max,
  );
  const maxPrice = pick(
    all.map((b) => b.maxPrice),
    Math.min,
  );
  const suggested = all[0].suggestedPrice;
  const fits = suggested !== null && (minPrice === null || suggested >= minPrice) && (maxPrice === null || suggested <= maxPrice);
  return { minPrice, maxPrice, suggestedPrice: fits ? suggested : null };
}

/**
 * Si el canal va a aceptar ese descuento: small si el precio con descuento
 * queda más alto de lo que acepta (le parece chico), big si queda más bajo.
 * null sin descuento, sin precio o sin rango.
 */
export function discountFit(listPrice: number, pct: number, bounds: DiscountBounds | null): 'ok' | 'small' | 'big' | null {
  if (!(pct > 0) || !(listPrice > 0) || !bounds) return null;
  const deal = dealPrice(listPrice, pct);
  if (bounds.maxPrice !== null && deal > bounds.maxPrice) return 'small';
  if (bounds.minPrice !== null && deal < bounds.minPrice) return 'big';
  return 'ok';
}

/** El descuento más chico, con dos decimales, que deja el precio con descuento en ese precio o menos. */
export function pctForPrice(listPrice: number, price: number): number | null {
  if (!(listPrice > 0) || !(price > 0) || price >= listPrice) return null;
  let pct = Math.ceil((1 - price / listPrice) * 10_000) / 100;
  // Con el redondeo a pesos enteros, que no quede un peso arriba.
  while (dealPrice(listPrice, pct) > price) pct = Math.round(pct * 100 + 1) / 100;
  return pct;
}

/** El descuento más grande, con dos decimales, que no deja el precio con descuento debajo de ese precio. */
export function pctUpToPrice(listPrice: number, price: number): number | null {
  if (!(listPrice > 0) || !(price > 0) || price >= listPrice) return null;
  let pct = Math.floor((1 - price / listPrice) * 10_000) / 100;
  while (pct > 0 && dealPrice(listPrice, pct) < price) pct = Math.round(pct * 100 - 1) / 100;
  return pct;
}

/**
 * Los descuentos en % que acepta el canal con ese precio publicado: el más
 * chico, el más grande y el sugerido, dentro del rango en % que acepta el
 * canal. null si no se puede saber o no entra.
 */
export function discountOptions(
  listPrice: number,
  bounds: DiscountBounds | null,
  range: { min: number; max: number } | null,
): { smallest: number | null; largest: number | null; suggested: number | null } {
  if (!bounds || !(listPrice > 0)) return { smallest: null, largest: null, suggested: null };
  const inRange = (pct: number | null) => (pct !== null && (!range || (pct >= range.min && pct <= range.max)) ? pct : null);
  // Sin tope arriba de lo que cuesta hoy, el más chico es el mínimo del canal.
  const smallest = bounds.maxPrice !== null ? inRange(Math.max(pctForPrice(listPrice, bounds.maxPrice) ?? 0, range?.min ?? 0) || null) : null;
  const upTo = bounds.minPrice !== null ? pctUpToPrice(listPrice, bounds.minPrice) : null;
  const largest = upTo !== null && range ? Math.min(upTo, range.max) : upTo;
  const suggested = bounds.suggestedPrice !== null ? inRange(pctForPrice(listPrice, bounds.suggestedPrice)) : null;
  return { smallest, largest: largest !== null && largest > 0 ? largest : null, suggested };
}

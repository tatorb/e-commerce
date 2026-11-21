// Las cuentas de una inscripción a mano: de la rentabilidad, el precio o el
// porcentaje que carga la persona salen los otros dos. Es una cuenta simple,
// para poder hacerla igual en el navegador mientras se escribe y en el
// servidor al guardar. Sin la base de datos.

/** Con qué se cargó el precio: la rentabilidad buscada, el precio para el comprador o el % de descuento sobre el de lista. */
export const PRICE_BYS = ['MARGIN', 'PRICE', 'PCT'] as const;
export type PriceBy = (typeof PRICE_BYS)[number];

/** Lo que hace falta de una publicación para sacar su rentabilidad a cualquier precio. */
export type Calc = {
  // El costo de reposición sin IVA. Null si no está cargado.
  cost: number | null;
  // La parte de cada peso que queda después de los cargos, los impuestos y el costo de sus cuotas.
  keep: number | null;
  // Los montos fijos por venta: envío y embalaje.
  fixed: number;
  // El precio de lista de hoy en el canal.
  listPrice: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** La rentabilidad sobre el costo que deja ese precio, en %. channelPct: lo que pone el canal, en % del precio de lista. */
export function marginOfPrice(c: Calc, price: number, channelPct: number | null = null, listPrice: number | null = c.listPrice): number | null {
  if (c.cost === null || !(c.cost > 0) || c.keep === null) return null;
  const revenue = price + (channelPct && listPrice ? (listPrice * channelPct) / 100 : 0);
  return round2(((revenue * c.keep - c.fixed - c.cost) / c.cost) * 100);
}

/** El precio para el comprador que deja esa rentabilidad, en pesos enteros para arriba. */
export function priceOfMargin(c: Calc, marginPct: number, channelPct: number | null = null, listPrice: number | null = c.listPrice): number | null {
  if (c.cost === null || !(c.cost > 0) || c.keep === null || !(c.keep > 0)) return null;
  const revenue = (c.cost * (1 + marginPct / 100) + c.fixed) / c.keep;
  return Math.max(1, Math.ceil(revenue - (channelPct && listPrice ? (listPrice * channelPct) / 100 : 0) - 1e-6));
}

/** El % de descuento sobre el precio de lista que es ese precio. */
export const pctOfPrice = (listPrice: number | null, price: number): number | null => (listPrice && listPrice > 0 ? round2((1 - price / listPrice) * 100) : null);

/** El precio que queda con ese % de descuento sobre el de lista, en pesos enteros. */
export const priceOfPct = (listPrice: number | null, pct: number): number | null => (listPrice && listPrice > 0 ? Math.round(listPrice * (1 - pct / 100)) : null);

export type Quote = { price: number | null; pct: number | null; marginPct: number | null };

/** Los tres números a partir del que se cargó. */
export function quote(c: Calc, by: PriceBy, value: number, channelPct: number | null = null, listPrice: number | null = c.listPrice): Quote {
  if (!Number.isFinite(value)) return { price: null, pct: null, marginPct: null };
  const price = by === 'PRICE' ? Math.round(value) : by === 'PCT' ? priceOfPct(listPrice, value) : priceOfMargin(c, value, channelPct, listPrice);
  if (price === null || !(price > 0)) return { price: null, pct: null, marginPct: null };
  return { price, pct: pctOfPrice(listPrice, price), marginPct: marginOfPrice(c, price, channelPct, listPrice) };
}

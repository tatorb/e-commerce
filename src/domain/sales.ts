import { vatShare, type PricingParams } from './pricing';
import { dayStartIn } from './sync-log';
import { dayIn } from './tasks';

// Las cuentas de la sección Ventas: lo que deja cada venta y el resumen de un
// período, con lo cobrado y lo que falta liberar. Los importes del canal
// incluyen IVA; el costo de reposición es sin IVA, como en el paso Precio. Sin
// la base de datos ni el canal, para poder probarlo solo.

export type SaleState = 'PENDING' | 'PAID' | 'CANCELLED';
export type ShipState = 'NONE' | 'PENDING' | 'TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'NOT_DELIVERED' | 'RETURNED' | 'CANCELLED';

export const SALE_STATE_LABEL: Record<SaleState, string> = { PENDING: 'Sin pagar', PAID: 'Pagada', CANCELLED: 'Cancelada' };

export const SHIP_STATE_LABEL: Record<ShipState, string> = {
  NONE: 'Sin envío del canal',
  PENDING: 'Todavía no se puede preparar',
  TO_SHIP: 'Para despachar',
  SHIPPED: 'En camino',
  DELIVERED: 'Entregado',
  NOT_DELIVERED: 'No se entregó',
  RETURNED: 'Volvió al vendedor',
  CANCELLED: 'Envío cancelado',
};

export const CANCEL_BY_LABEL: Record<string, string> = { buyer: 'el comprador', seller: 'el vendedor', channel: 'el canal' };

/** Lo que se cuenta de los parámetros de la cuenta: la tasa del IVA, los impuestos, el embalaje y el cargo para estimar la comisión. */
export type SaleParams = Pick<PricingParams, 'vatRatePct' | 'taxesPct' | 'packaging' | 'channelFeePct'>;

export type SaleMoneyInput = {
  state: SaleState;
  itemsAmount: number;
  listAmount: number | null;
  fee: number | null;
  shippingCost: number | null;
  netReceived: number | null;
  // El costo de reposición de toda la venta, sin IVA. Null si falta el de alguna línea.
  cost: number | null;
  params: SaleParams;
};

export type SaleMoney = {
  cancelled: boolean;
  sold: number;
  // Lo que se descontó sobre el precio publicado. Null si el canal no lo informa.
  discount: number | null;
  fee: number;
  // La comisión no vino del canal: se estimó con el cargo de la cuenta.
  feeEstimated: boolean;
  shipping: number;
  // El costo del envío todavía no se sabe: cuenta como 0.
  shippingUnknown: boolean;
  // Lo que deja la venta después de lo que cobra el canal.
  net: number;
  // Lo que entra a la cuenta: lo que informa el medio de pago o, sin ese dato, el neto.
  received: number;
  receivedFromPayment: boolean;
  // Lo que el medio de pago retuvo de más, como retenciones de impuestos. 0 si no hay diferencia o no se sabe.
  withheld: number;
  // Estimados con los parámetros de la cuenta.
  vat: number;
  taxes: number;
  packaging: number;
  cost: number | null;
  profit: number | null;
  // La ganancia sobre el costo, en %, como el margen del paso Precio.
  marginPct: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lo que deja una venta. Una cancelada no deja nada: el canal devuelve lo que cobró. */
export function saleMoney(s: SaleMoneyInput): SaleMoney {
  if (s.state === 'CANCELLED') {
    return {
      cancelled: true,
      sold: 0,
      discount: null,
      fee: 0,
      feeEstimated: false,
      shipping: 0,
      shippingUnknown: false,
      net: 0,
      received: 0,
      receivedFromPayment: false,
      withheld: 0,
      vat: 0,
      taxes: 0,
      packaging: 0,
      cost: null,
      profit: null,
      marginPct: null,
    };
  }
  const sold = s.itemsAmount;
  const fee = s.fee ?? round2((sold * s.params.channelFeePct) / 100);
  const shipping = s.shippingCost ?? 0;
  const net = round2(sold - fee - shipping);
  const received = s.netReceived ?? net;
  const vat = round2(sold * vatShare(s.params as PricingParams));
  const taxes = round2((sold * s.params.taxesPct) / 100);
  const packaging = s.params.packaging;
  const profit = s.cost === null ? null : round2(net - vat - taxes - packaging - s.cost);
  return {
    cancelled: false,
    sold,
    discount: s.listAmount !== null && s.listAmount > sold ? round2(s.listAmount - sold) : s.listAmount !== null ? 0 : null,
    fee,
    feeEstimated: s.fee === null,
    shipping,
    shippingUnknown: s.shippingCost === null,
    net,
    received,
    receivedFromPayment: s.netReceived !== null,
    withheld: s.netReceived !== null && net - s.netReceived > 0.5 ? round2(net - s.netReceived) : 0,
    vat,
    taxes,
    packaging,
    cost: s.cost,
    profit,
    marginPct: profit !== null && s.cost !== null && s.cost > 0 ? round2((profit / s.cost) * 100) : null,
  };
}

/** El costo de una venta: la suma de sus líneas. Null si a alguna le falta. */
export function saleCost(lines: { cost: number | null; quantity: number }[]): number | null {
  if (lines.length === 0 || lines.some((l) => l.cost === null)) return null;
  return round2(lines.reduce((sum, l) => sum + l.cost! * l.quantity, 0));
}

/**
 * El costo del envío de un carrito, repartido entre sus ventas según lo que
 * pagó el comprador por cada una. El último se lleva lo que sobra del redondeo.
 */
export function splitShipping(total: number, amounts: number[]): number[] {
  if (amounts.length === 0) return [];
  const sum = amounts.reduce((a, b) => a + b, 0);
  const parts = amounts.map((a) => (sum > 0 ? round2((total * a) / sum) : round2(total / amounts.length)));
  parts[parts.length - 1] = round2(total - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts;
}

// ───────────────────────────── El resumen de un período ─────────────────────────────

export type SummaryRow = { state: SaleState; claim: boolean; units: number; money: SaleMoney; itemsAmount: number };

export type SalesSummary = {
  count: number;
  units: number;
  sold: number;
  discount: number;
  fee: number;
  shipping: number;
  net: number;
  vat: number;
  taxes: number;
  packaging: number;
  // Solo de las ventas con el costo de todas sus líneas.
  withCost: { count: number; sold: number; cost: number; profit: number; marginPct: number | null };
  withoutCost: number;
  // Las que el canal todavía no informó cuánto cobró por el envío.
  shippingUnknown: number;
  cancelled: { count: number; amount: number };
  pending: { count: number; amount: number };
  claims: number;
};

/** Suma las ventas del período. Las canceladas y las sin pagar se cuentan aparte. */
export function summarize(rows: SummaryRow[]): SalesSummary {
  const out: SalesSummary = {
    count: 0,
    units: 0,
    sold: 0,
    discount: 0,
    fee: 0,
    shipping: 0,
    net: 0,
    vat: 0,
    taxes: 0,
    packaging: 0,
    withCost: { count: 0, sold: 0, cost: 0, profit: 0, marginPct: null },
    withoutCost: 0,
    shippingUnknown: 0,
    cancelled: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
    claims: 0,
  };
  for (const r of rows) {
    if (r.claim) out.claims++;
    if (r.state === 'CANCELLED') {
      out.cancelled.count++;
      out.cancelled.amount += r.itemsAmount;
      continue;
    }
    if (r.state === 'PENDING') {
      out.pending.count++;
      out.pending.amount += r.itemsAmount;
      continue;
    }
    const m = r.money;
    out.count++;
    out.units += r.units;
    out.sold += m.sold;
    out.discount += m.discount ?? 0;
    out.fee += m.fee;
    out.shipping += m.shipping;
    out.net += m.net;
    out.vat += m.vat;
    out.taxes += m.taxes;
    out.packaging += m.packaging;
    if (m.shippingUnknown) out.shippingUnknown++;
    if (m.profit !== null && m.cost !== null) {
      out.withCost.count++;
      out.withCost.sold += m.sold;
      out.withCost.cost += m.cost;
      out.withCost.profit += m.profit;
    } else out.withoutCost++;
  }
  for (const k of ['sold', 'discount', 'fee', 'shipping', 'net', 'vat', 'taxes', 'packaging'] as const) out[k] = round2(out[k]);
  out.cancelled.amount = round2(out.cancelled.amount);
  out.pending.amount = round2(out.pending.amount);
  out.withCost.sold = round2(out.withCost.sold);
  out.withCost.cost = round2(out.withCost.cost);
  out.withCost.profit = round2(out.withCost.profit);
  out.withCost.marginPct = out.withCost.cost > 0 ? round2((out.withCost.profit / out.withCost.cost) * 100) : null;
  return out;
}

// ───────────────────────────── La plata que entra ─────────────────────────────

export type CashRow = { state: SaleState; received: number; releaseAt: Date | null; released: boolean | null };

export type CashFlow = {
  // Liberado dentro del período, por la fecha en que se liberó.
  released: { amount: number; count: number };
  // Lo que todavía no se liberó, de cualquier fecha de venta: por día de liberación, y sin fecha o retenido.
  waiting: { amount: number; count: number; days: { day: string; amount: number; count: number }[]; undated: { amount: number; count: number } };
};

/** Si la plata de la venta ya está disponible. */
export function isReleased(r: Pick<CashRow, 'releaseAt' | 'released'>, now: Date): boolean {
  return r.released === true || (r.released !== false && r.releaseAt !== null && r.releaseAt <= now);
}

/**
 * Lo cobrado en el período y lo que falta liberar. released mira las ventas
 * liberadas entre from y to; waiting, todas las pagadas que todavía no.
 */
export function cashFlow(rows: CashRow[], range: { from: Date; to: Date }, now: Date, timeZone: string): CashFlow {
  const out: CashFlow = { released: { amount: 0, count: 0 }, waiting: { amount: 0, count: 0, days: [], undated: { amount: 0, count: 0 } } };
  const days = new Map<string, { amount: number; count: number }>();
  for (const r of rows) {
    if (r.state !== 'PAID') continue;
    if (isReleased(r, now)) {
      const when = r.releaseAt;
      if (when && when >= range.from && when < range.to) {
        out.released.amount += r.received;
        out.released.count++;
      }
      continue;
    }
    out.waiting.amount += r.received;
    out.waiting.count++;
    // Sin fecha, o con la fecha pasada y todavía retenida, por ejemplo por un reclamo.
    if (!r.releaseAt || r.releaseAt <= now) {
      out.waiting.undated.amount += r.received;
      out.waiting.undated.count++;
      continue;
    }
    const day = dayIn(r.releaseAt, timeZone);
    const d = days.get(day) ?? { amount: 0, count: 0 };
    d.amount += r.received;
    d.count++;
    days.set(day, d);
  }
  out.released.amount = round2(out.released.amount);
  out.waiting.amount = round2(out.waiting.amount);
  out.waiting.undated.amount = round2(out.waiting.undated.amount);
  out.waiting.days = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({ day, amount: round2(d.amount), count: d.count }));
  return out;
}

// ───────────────────────────── Los períodos ─────────────────────────────

export const PERIODS = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
  { key: '30d', label: '30 días' },
  { key: '12m', label: '12 meses' },
] as const;

export type PeriodKey = (typeof PERIODS)[number]['key'] | 'fechas';

export type Period = { key: PeriodKey; from: Date; to: Date; fromDay: string; toDay: string; label: string };

const isDay = (s: string | undefined): s is string => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function addMonths(day: string, n: number): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** "27/10/2026". */
export const dayText = (day: string) => day.split('-').reverse().join('/');

/**
 * El período elegido, en la zona horaria de la cuenta: un atajo, o desde y
 * hasta, los dos días incluidos. to es el comienzo del día siguiente al último.
 */
export function parsePeriod(search: { periodo?: string; desde?: string; hasta?: string }, now: Date, timeZone: string, fallback: PeriodKey = '30d'): Period {
  const today = dayIn(now, timeZone);
  const make = (key: PeriodKey, fromDay: string, toDay: string, label: string): Period => ({
    key,
    from: dayStartIn(fromDay, timeZone)!,
    to: dayStartIn(addDays(toDay, 1), timeZone)!,
    fromDay,
    toDay,
    label,
  });
  if (isDay(search.desde) || isDay(search.hasta)) {
    let from = isDay(search.desde) && dayStartIn(search.desde, timeZone) ? search.desde : addDays(today, -29);
    let to = isDay(search.hasta) && dayStartIn(search.hasta, timeZone) ? search.hasta : today;
    if (from > to) [from, to] = [to, from];
    return make('fechas', from, to, from === to ? `El ${dayText(from)}` : `Del ${dayText(from)} al ${dayText(to)}`);
  }
  const key = PERIODS.some((p) => p.key === search.periodo) ? (search.periodo as PeriodKey) : fallback;
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (key) {
    case 'hoy':
      return make(key, today, today, 'Hoy');
    case '7d':
      return make(key, addDays(today, -6), today, 'Los últimos 7 días');
    case 'mes':
      return make(key, monthStart, today, 'Este mes');
    case 'mes-pasado': {
      const start = addMonths(monthStart, -1);
      return make(key, start, addDays(monthStart, -1), 'El mes pasado');
    }
    case '12m':
      return make(key, addDays(addMonths(today, -12), 1), today, 'Los últimos 12 meses');
    default:
      return make('30d', addDays(today, -29), today, 'Los últimos 30 días');
  }
}

// ───────────────────────────── Los envíos ─────────────────────────────

/** Si hay que despacharlo y lo despacha la tienda: los del depósito del canal los despacha el canal. */
export const sellerShips = (s: { shipState: ShipState; shipKind: string | null }) => s.shipState === 'TO_SHIP' && s.shipKind !== 'channel';

/** Cuánto falta para la hora límite de despacho: vencido, hoy, o más adelante. */
export function dispatchUrgency(dispatchBy: Date | null, now: Date, timeZone: string): 'late' | 'today' | 'later' | null {
  if (!dispatchBy) return null;
  if (dispatchBy < now) return 'late';
  return dayIn(dispatchBy, timeZone) === dayIn(now, timeZone) ? 'today' : 'later';
}

/** Las palabras para buscar una venta: códigos, comprador, títulos, SKU y productos. */
export function searchTextOf(parts: (string | null | undefined)[]): string {
  return [...new Set(parts.filter((p): p is string => !!p && p.trim() !== '').map((p) => p.trim().toLowerCase()))].join(' ').slice(0, 4000);
}

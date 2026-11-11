import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { SaleShipState, SaleState } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { getChannelSalesLedger } from '@/channels/sales';
import { costMap } from '@/lib/costs';
import { costOf } from '@/domain/costs';
import { matchSlot, NO_MEASURE, stockSlots } from '@/domain/stock';
import { loadPricingSettings } from '@/lib/pricing';
import {
  cashFlow,
  dispatchUrgency,
  isReleased,
  saleCost,
  saleMoney,
  sellerShips,
  summarize,
  type CashFlow,
  type Period,
  type SaleMoney,
  type SaleParams,
  type SalesSummary,
} from '@/domain/sales';
import { HISTORY_DAYS, parseLines, parsePayments, type SaleLineRow } from './read';

// Lo que muestran las pantallas de Ventas y lo que ve Claude: la lista con sus
// filtros, una venta, la caja de un período y los envíos. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

// ───────────────────────────── El costo de cada línea ─────────────────────────────

/** Lo que se sabe hoy de una línea vendida: la medida del producto y su costo de reposición por unidad. */
export type LineFacts = {
  key: string | null;
  measure: string | null;
  unitCost: number | null;
  // La SKU: la que mandó el canal con la venta o, si no mandó ninguna, la de esa medida en el producto.
  sku: string | null;
};

/**
 * La medida y el costo de reposición por unidad de cada línea vendida, con los
 * datos de hoy del producto. Si la medida guardada con la venta falta o ya no
 * está en el producto (se leyó antes de cargar los SKU, o se renombró), se
 * busca de nuevo por el SKU vendido.
 */
export async function lineFacts(db: Db, accountId: string, lines: SaleLineRow[]): Promise<(line: SaleLineRow) => LineFacts> {
  const ids = new Set<string>();
  for (const l of lines) {
    if (l.productId) ids.add(l.productId);
    for (const p of l.parts ?? []) ids.add(p.productId);
  }
  const products = ids.size
    ? await db.product.findMany({
        where: { id: { in: [...ids] }, accountId },
        select: { id: true, replacementCost: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } }, costs: { select: { key: true, cost: true } } },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, { costs: costMap(p.costs), general: p.replacementCost === null ? null : Number(p.replacementCost), slots: stockSlots(p.variants) }]));
  const unit = (productId: string, key: string | null): number | null => {
    const p = byId.get(productId);
    if (!p || key === null) return null;
    return costOf(p.costs, p.general, key);
  };
  // La medida de la línea en el producto de hoy: la guardada si sigue, si no la del SKU vendido.
  const keyOf = (line: SaleLineRow): string | null => {
    const p = line.productId ? byId.get(line.productId) : undefined;
    if (!p) return line.key;
    if (p.slots.length === 1 && p.slots[0].key === NO_MEASURE) return NO_MEASURE;
    if (line.key && p.slots.some((s) => s.key === line.key)) return line.key;
    return line.sku ? matchSlot(p.slots, { sku: line.sku, measure: null }) : null;
  };
  return (line) => {
    const sold = line.sku?.trim() || null;
    if (!line.productId) return { key: null, measure: line.measure, unitCost: null, sku: sold };
    const key = keyOf(line);
    const p = byId.get(line.productId);
    const slot = key === null ? undefined : p?.slots.find((s) => s.key === key);
    const measure = key === null ? null : key === NO_MEASURE ? line.measure : (slot?.label ?? line.measure);
    const sku = sold ?? (slot?.sku?.trim() || null);
    const own = unit(line.productId, key);
    if (own !== null) return { key, measure, unitCost: own, sku };
    // Un combo sin costo propio: lo que cuestan sus piezas.
    if (!line.parts?.length) return { key, measure, unitCost: null, sku };
    let sum = 0;
    for (const part of line.parts) {
      const c = unit(part.productId, part.key);
      if (c === null) return { key, measure, unitCost: null, sku };
      sum += c * part.quantity;
    }
    return { key, measure, unitCost: sum, sku };
  };
}

/** Los parámetros de la cuenta que se usan para estimar el IVA, los impuestos y el embalaje. */
export async function saleParams(db: Db, accountId: string): Promise<SaleParams> {
  const { params } = await loadPricingSettings(db, accountId);
  return { vatRatePct: params.vatRatePct, taxesPct: params.taxesPct, packaging: params.packaging, channelFeePct: params.channelFeePct };
}

// ───────────────────────────── La lista ─────────────────────────────

export const SALE_FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'pagadas', label: 'Pagadas' },
  { key: 'sin-pagar', label: 'Sin pagar' },
  { key: 'canceladas', label: 'Canceladas' },
  { key: 'reclamos', label: 'Con reclamo' },
] as const;
export type SaleFilter = (typeof SALE_FILTERS)[number]['key'];

export const SHIP_FILTERS = [
  { key: 'todos', label: 'Todos los envíos' },
  { key: 'despachar', label: 'Para despachar' },
  { key: 'camino', label: 'En camino' },
  { key: 'entregados', label: 'Entregados' },
  { key: 'problemas', label: 'Con problemas' },
  { key: 'full', label: 'Despacha el canal' },
] as const;
export type ShipFilter = (typeof SHIP_FILTERS)[number]['key'];

export const parseSaleFilter = (raw: string | undefined): SaleFilter => (SALE_FILTERS.some((f) => f.key === raw) ? (raw as SaleFilter) : 'todas');
export const parseShipFilter = (raw: string | undefined): ShipFilter => (SHIP_FILTERS.some((f) => f.key === raw) ? (raw as ShipFilter) : 'todos');

const PROBLEM: SaleShipState[] = ['NOT_DELIVERED', 'RETURNED'];

function where(accountId: string, f: { period?: Pick<Period, 'from' | 'to'> | null; state?: SaleFilter; ship?: ShipFilter; q?: string; storeId?: string | null }): Prisma.SaleWhereInput {
  const and: Prisma.SaleWhereInput[] = [{ store: { accountId } }];
  if (f.storeId) and.push({ storeId: f.storeId });
  if (f.period) and.push({ orderedAt: { gte: f.period.from, lt: f.period.to } });
  switch (f.state) {
    case 'pagadas':
      and.push({ state: 'PAID' });
      break;
    case 'sin-pagar':
      and.push({ state: 'PENDING' });
      break;
    case 'canceladas':
      and.push({ state: 'CANCELLED' });
      break;
    case 'reclamos':
      and.push({ claim: true });
      break;
  }
  switch (f.ship) {
    case 'despachar':
      and.push({ shipState: 'TO_SHIP', NOT: { shipKind: 'channel' } });
      break;
    case 'camino':
      and.push({ shipState: 'SHIPPED' });
      break;
    case 'entregados':
      and.push({ shipState: 'DELIVERED' });
      break;
    case 'problemas':
      and.push({ OR: [{ shipState: { in: PROBLEM } }, { shipDelayed: true, shipState: { in: ['TO_SHIP', 'SHIPPED'] } }] });
      break;
    case 'full':
      and.push({ shipKind: 'channel' });
      break;
  }
  const words = (f.q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const w of words) and.push({ searchText: { contains: w } });
  return { AND: and };
}

const ROW_SELECT = {
  id: true,
  orderId: true,
  packId: true,
  state: true,
  orderedAt: true,
  currency: true,
  itemsAmount: true,
  listAmount: true,
  fee: true,
  shippingCost: true,
  netReceived: true,
  releaseAt: true,
  released: true,
  buyerNickname: true,
  buyerName: true,
  lines: true,
  shipState: true,
  shipKind: true,
  shipKindLabel: true,
  shipDetail: true,
  shipDelayed: true,
  dispatchBy: true,
  deliveredAt: true,
  closedAt: true,
  claim: true,
  delivered: true,
  detailsAt: true,
  store: { select: { id: true, name: true, channel: { select: { kind: true, name: true } } } },
} satisfies Prisma.SaleSelect;

type RawRow = Prisma.SaleGetPayload<{ select: typeof ROW_SELECT }>;

export type SaleRow = {
  id: string;
  orderId: string;
  packId: string | null;
  state: SaleState;
  orderedAt: Date;
  currency: string;
  buyer: string | null;
  storeName: string;
  channelName: string;
  lines: (SaleLineRow & { unitCost: number | null })[];
  units: number;
  money: SaleMoney;
  shipState: SaleShipState;
  shipKind: string | null;
  shipKindLabel: string | null;
  shipDetail: string | null;
  shipDelayed: boolean;
  dispatchBy: Date | null;
  deliveredAt: Date | null;
  claim: boolean;
  releaseAt: Date | null;
  released: boolean | null;
  // La fecha en que la plata quedó o queda disponible: la del medio de pago o, sin ella, la entrega.
  cashAt: Date | null;
  // Falta leer el envío y el pago.
  incomplete: boolean;
  url: string | null;
};

const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

/** Las filas con sus cuentas: lo que deja cada venta y su costo. */
async function shape(db: Db, accountId: string, raw: RawRow[], params?: SaleParams): Promise<SaleRow[]> {
  const p = params ?? (await saleParams(db, accountId));
  const allLines = raw.flatMap((r) => parseLines(r.lines));
  const factsOf = await lineFacts(db, accountId, allLines);
  return raw.map((r) => {
    const lines = parseLines(r.lines).map((l) => ({ ...l, ...factsOf(l) }));
    const cost = saleCost(lines.map((l) => ({ cost: l.unitCost, quantity: l.quantity })));
    const money = saleMoney({
      state: r.state,
      itemsAmount: Number(r.itemsAmount),
      listAmount: num(r.listAmount),
      fee: num(r.fee),
      shippingCost: num(r.shippingCost),
      netReceived: num(r.netReceived),
      cost,
      params: p,
    });
    const ledger = getChannelSalesLedger(r.store.channel.kind);
    return {
      id: r.id,
      orderId: r.orderId,
      packId: r.packId,
      state: r.state,
      orderedAt: r.orderedAt,
      currency: r.currency,
      buyer: r.buyerNickname ?? r.buyerName,
      storeName: r.store.name,
      channelName: getChannelAdapter(r.store.channel.kind, r.store.channel.name).name,
      lines,
      units: lines.reduce((s, l) => s + l.quantity, 0),
      money,
      shipState: r.shipState,
      shipKind: r.shipKind,
      shipKindLabel: r.shipKindLabel,
      shipDetail: r.shipDetail,
      shipDelayed: r.shipDelayed,
      dispatchBy: r.dispatchBy,
      deliveredAt: r.deliveredAt,
      claim: r.claim,
      releaseAt: r.releaseAt,
      released: r.released,
      cashAt: r.releaseAt ?? (r.released ? (r.deliveredAt ?? r.closedAt ?? r.orderedAt) : null),
      incomplete: r.detailsAt === null,
      url: ledger?.saleUrl(r.orderId) ?? null,
    };
  });
}

export const PAGE_SIZE = 50;

export type SalesFilters = { period: Period | null; state: SaleFilter; ship: ShipFilter; q: string; storeId?: string | null; page?: number; take?: number };

/** Las ventas de la cuenta con los filtros, las más nuevas primero, y el resumen de todas las que coinciden. */
export async function listSales(db: Db, accountId: string, f: SalesFilters) {
  const w = where(accountId, f);
  const page = Math.max(1, f.page ?? 1);
  const take = f.take ?? PAGE_SIZE;
  const params = await saleParams(db, accountId);
  const [total, raw, all] = await Promise.all([
    db.sale.count({ where: w }),
    db.sale.findMany({ where: w, orderBy: { orderedAt: 'desc' }, skip: (page - 1) * take, take, select: ROW_SELECT }),
    db.sale.findMany({ where: w, select: ROW_SELECT }),
  ]);
  const [rows, everything] = await Promise.all([shape(db, accountId, raw, params), shape(db, accountId, all, params)]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / take)), summary: summaryOf(everything) };
}

function summaryOf(rows: SaleRow[]): SalesSummary {
  return summarize(rows.map((r) => ({ state: r.state, claim: r.claim, units: r.units, money: r.money, itemsAmount: Number(r.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)) })));
}

// ───────────────────────────── Una venta ─────────────────────────────

/** Una venta con todo: las líneas con su publicación y producto, el pago, el envío y lo que movió del stock. */
export async function getSale(db: Db, accountId: string, saleId: string) {
  const raw = await db.sale.findFirst({ where: { id: saleId, store: { accountId } }, select: { ...ROW_SELECT, storeId: true, payments: true, paidAmount: true, buyerShipping: true, tracking: true, estimatedAt: true, shippedAt: true, refunded: true, cancelBy: true, cancelReason: true, buyerName: true, buyerNickname: true, checkedAt: true } });
  if (!raw) return null;
  const [row] = await shape(db, accountId, [raw]);
  const pubIds = [...new Set(row.lines.flatMap((l) => (l.publicationId ? [l.publicationId] : [])))];
  const productIds = [...new Set(row.lines.flatMap((l) => (l.productId ? [l.productId] : [])))];
  const [pubs, products, stockSale, others] = await Promise.all([
    db.publication.findMany({ where: { id: { in: pubIds } }, select: { id: true, title: true, externalId: true } }),
    db.product.findMany({ where: { id: { in: productIds }, accountId }, select: { id: true, name: true } }),
    db.channelSale.findUnique({
      where: { storeId_orderId: { storeId: raw.storeId, orderId: raw.orderId } },
      select: { status: true, moves: { orderBy: { id: 'asc' }, select: { delta: true, after: true, key: true, product: { select: { id: true, name: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } } } } },
    }),
    // Las otras ventas del mismo carrito.
    raw.packId ? db.sale.findMany({ where: { storeId: raw.storeId, packId: raw.packId, id: { not: raw.id } }, select: { id: true, orderId: true } }) : Promise.resolve([]),
  ]);
  return {
    ...row,
    payments: parsePayments(raw.payments),
    paidAmount: num(raw.paidAmount),
    buyerShipping: num(raw.buyerShipping),
    refunded: num(raw.refunded),
    tracking: raw.tracking,
    estimatedAt: raw.estimatedAt,
    shippedAt: raw.shippedAt,
    cancelBy: raw.cancelBy,
    cancelReason: raw.cancelReason,
    buyerName: raw.buyerName,
    buyerNickname: raw.buyerNickname,
    checkedAt: raw.checkedAt,
    publications: new Map(pubs.map((p) => [p.id, p])),
    products: new Map(products.map((p) => [p.id, p])),
    stock: stockSale
      ? {
          status: stockSale.status,
          moves: stockSale.moves.map((m) => ({
            productId: m.product.id,
            productName: m.product.name,
            measure: stockSlots(m.product.variants).find((s) => s.key === m.key)?.label ?? '',
            delta: m.delta,
            after: m.after,
          })),
        }
      : null,
    packSales: others,
  };
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

/** Una venta por su código en el canal, para Claude. */
export async function findSaleId(db: Db, accountId: string, ref: string): Promise<string | null> {
  const r = await db.sale.findFirst({ where: { store: { accountId }, OR: [{ id: ref }, { orderId: ref }, { packId: ref }] }, select: { id: true } });
  return r?.id ?? null;
}

// ───────────────────────────── La caja ─────────────────────────────

export type ProductResult = { productId: string | null; name: string; units: number; sold: number; cost: number | null; profit: number | null; sales: number };

export type CashPage = {
  summary: SalesSummary;
  cash: CashFlow;
  products: ProductResult[];
  days: { day: string; sold: number; count: number }[];
};

/**
 * La caja de un período: lo vendido con lo que se llevó el canal y la
 * ganancia, la plata liberada en el período y la que falta liberar, lo que
 * dejó cada producto y lo vendido día por día.
 */
export async function cashPage(db: Db, accountId: string, period: Period, now: Date, timeZone: string): Promise<CashPage> {
  const params = await saleParams(db, accountId);
  const [inPeriod, waiting, releasedIn] = await Promise.all([
    db.sale.findMany({ where: where(accountId, { period }), select: ROW_SELECT }),
    // Lo que falta liberar, de cualquier fecha.
    db.sale.findMany({
      where: { store: { accountId }, state: 'PAID', AND: [{ OR: [{ released: null }, { released: false }] }, { OR: [{ releaseAt: null }, { releaseAt: { gt: now } }] }] },
      select: ROW_SELECT,
    }),
    // Lo liberado en el período, por su fecha de liberación o, sin ella, de entrega.
    db.sale.findMany({
      where: {
        store: { accountId },
        state: 'PAID',
        OR: [
          { releaseAt: { gte: period.from, lt: period.to } },
          { releaseAt: null, released: true, OR: [{ deliveredAt: { gte: period.from, lt: period.to } }, { deliveredAt: null, closedAt: { gte: period.from, lt: period.to } }] },
        ],
      },
      select: ROW_SELECT,
    }),
  ]);
  const [rows, waitRows, relRows] = await Promise.all([shape(db, accountId, inPeriod, params), shape(db, accountId, waiting, params), shape(db, accountId, releasedIn, params)]);
  const cashRows = [...new Map([...waitRows, ...relRows].map((r) => [r.id, r])).values()].map((r) => ({
    state: r.state,
    received: r.money.received,
    releaseAt: r.cashAt,
    released: isReleased({ releaseAt: r.releaseAt, released: r.released }, now) ? true : r.released,
  }));
  // Por producto: cada línea con su parte de lo que dejó la venta.
  const byProduct = new Map<string, ProductResult>();
  for (const r of rows) {
    if (r.state !== 'PAID') continue;
    const sold = r.money.sold;
    for (const l of r.lines) {
      const k = l.productId ?? `canal:${l.listingId}`;
      const lineSold = l.unitPrice * l.quantity;
      const share = sold > 0 ? lineSold / sold : 0;
      const p = byProduct.get(k) ?? { productId: l.productId, name: l.title ?? l.listingId, units: 0, sold: 0, cost: 0, profit: 0, sales: 0 };
      p.units += l.quantity;
      p.sold += lineSold;
      p.sales++;
      p.cost = p.cost !== null && l.unitCost !== null ? p.cost + l.unitCost * l.quantity : null;
      p.profit = p.profit !== null && r.money.profit !== null ? p.profit + r.money.profit * share : null;
      byProduct.set(k, p);
    }
  }
  const productIds = [...byProduct.values()].flatMap((p) => (p.productId ? [p.productId] : []));
  const names = new Map((await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const products = [...byProduct.values()]
    .map((p) => ({ ...p, name: (p.productId && names.get(p.productId)) || p.name, sold: Math.round(p.sold * 100) / 100, profit: p.profit === null ? null : Math.round(p.profit * 100) / 100 }))
    .sort((a, b) => b.sold - a.sold);
  const days = new Map<string, { sold: number; count: number }>();
  const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  for (const r of rows) {
    if (r.state !== 'PAID') continue;
    const k = dayOf(r.orderedAt);
    const d = days.get(k) ?? { sold: 0, count: 0 };
    d.sold += r.money.sold;
    d.count++;
    days.set(k, d);
  }
  return {
    summary: summaryOf(rows),
    cash: cashFlow(cashRows, period, now, timeZone),
    products,
    days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({ day, sold: Math.round(d.sold * 100) / 100, count: d.count })),
  };
}

// ───────────────────────────── Los envíos ─────────────────────────────

export type ShipmentGroups = {
  toShip: SaleRow[];
  onTheWay: SaleRow[];
  problems: SaleRow[];
  delivered: SaleRow[];
  channel: SaleRow[];
};

/**
 * Los envíos de la cuenta: los que hay que despachar, por hora límite; los
 * que están en camino; los que tuvieron problemas; los entregados de los
 * últimos 7 días, y los que despacha el canal.
 */
export async function shipmentGroups(db: Db, accountId: string, now: Date): Promise<ShipmentGroups> {
  const recent = new Date(now.getTime() - 60 * 86_400_000);
  const raw = await db.sale.findMany({
    where: {
      store: { accountId },
      state: { not: 'CANCELLED' },
      OR: [
        { shipState: { in: ['TO_SHIP', 'SHIPPED', 'PENDING'] }, orderedAt: { gte: recent } },
        { shipState: { in: PROBLEM }, orderedAt: { gte: recent } },
        { shipState: 'DELIVERED', deliveredAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
      ],
    },
    orderBy: { orderedAt: 'desc' },
    select: ROW_SELECT,
  });
  const rows = await shape(db, accountId, raw);
  const byDeadline = (a: SaleRow, b: SaleRow) => (a.dispatchBy?.getTime() ?? Infinity) - (b.dispatchBy?.getTime() ?? Infinity);
  return {
    toShip: rows.filter((r) => sellerShips(r)).sort(byDeadline),
    onTheWay: rows.filter((r) => r.shipState === 'SHIPPED' && r.shipKind !== 'channel'),
    problems: rows.filter((r) => PROBLEM.includes(r.shipState) || (r.shipDelayed && (r.shipState === 'TO_SHIP' || r.shipState === 'SHIPPED'))),
    delivered: rows.filter((r) => r.shipState === 'DELIVERED' && r.shipKind !== 'channel'),
    channel: rows.filter((r) => r.shipKind === 'channel' && r.shipState !== 'DELIVERED'),
  };
}

/** Para el menú: los envíos que hay que despachar hoy o ya vencidos. */
export async function dispatchDueCount(db: Db, accountId: string, now: Date, timeZone: string): Promise<number> {
  const rows = await db.sale.findMany({
    where: { store: { accountId }, state: 'PAID', shipState: 'TO_SHIP', NOT: { shipKind: 'channel' }, orderedAt: { gte: new Date(now.getTime() - 60 * 86_400_000) } },
    select: { dispatchBy: true },
  });
  return rows.filter((r) => {
    const u = dispatchUrgency(r.dispatchBy, now, timeZone);
    return u === 'late' || u === 'today';
  }).length;
}

// ───────────────────────────── Cómo va la lectura ─────────────────────────────

export type ReaderStatus = {
  storeId: string;
  storeName: string;
  channelName: string;
  connected: boolean;
  readAt: Date | null;
  lastError: string | null;
  noticeAt: Date | null;
  history: { from: Date; done: boolean; cursor: Date | null; until: Date | null; pct: number } | null;
  sales: number;
  incomplete: number;
};

/** Cómo va la lectura de las ventas de cada tienda de la cuenta. */
export async function readerStatus(db: Db, accountId: string): Promise<ReaderStatus[]> {
  const stores = await db.store.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } }, saleReader: true },
  });
  const out: ReaderStatus[] = [];
  for (const s of stores) {
    if (!getChannelSalesLedger(s.channel.kind)) continue;
    const [sales, incomplete] = await Promise.all([db.sale.count({ where: { storeId: s.id } }), db.sale.count({ where: { storeId: s.id, detailsAt: null } })]);
    const r = s.saleReader;
    let history: ReaderStatus['history'] = null;
    if (r?.historyFrom) {
      const until = r.historyUntil ?? r.historyFrom;
      const span = Math.max(1, until.getTime() - r.historyFrom.getTime());
      const done = r.historyCursor === null;
      const at = r.historyCursor ?? until;
      history = { from: r.historyFrom, done, cursor: r.historyCursor, until: r.historyUntil, pct: done ? 100 : Math.min(99, Math.round(((at.getTime() - r.historyFrom.getTime()) / span) * 100)) };
    }
    out.push({
      storeId: s.id,
      storeName: s.name,
      channelName: getChannelAdapter(s.channel.kind, s.channel.name).name,
      connected: s.connection?.status === 'ACTIVE',
      readAt: r?.readAt ?? null,
      lastError: r?.lastError ?? null,
      noticeAt: r?.noticeAt ?? null,
      history,
      sales,
      incomplete,
    });
  }
  return out;
}

export { HISTORY_DAYS };

// ───────────────────────────── El historial de una publicación o un producto ─────────────────────────────

export type SalesHistory = {
  rows: SaleRow[];
  // Todas las que coinciden; rows trae las más nuevas.
  total: number;
  // Solo lo de sus líneas: en un carrito con otros productos, lo demás no cuenta.
  summary: { count: number; units: number; sold: number; profit: number | null; withoutCost: number; cancelled: number; currency: string };
  // Desde cuándo trae ventas la app.
  since: Date | null;
};

/**
 * Las ventas de esas publicaciones, las más nuevas primero, con un resumen de
 * lo que vendieron: ventas, unidades, lo vendido y lo que ganó. Una venta
 * cuenta por su publicación o por su código en el canal, aunque haya llegado
 * antes que la publicación. La ganancia de un carrito con otros productos se
 * reparte por lo que vale cada línea.
 */
export async function salesHistory(db: Db, accountId: string, publicationIds: string[], take = 30): Promise<SalesHistory> {
  const empty: SalesHistory = { rows: [], total: 0, summary: { count: 0, units: 0, sold: 0, profit: null, withoutCost: 0, cancelled: 0, currency: 'ARS' }, since: null };
  const pubs = await db.publication.findMany({ where: { id: { in: publicationIds }, product: { accountId } }, select: { id: true, externalId: true, storeId: true } });
  if (pubs.length === 0) return empty;
  const ids = pubs.map((p) => p.id);
  const codes = pubs.flatMap((p) => (p.externalId ? [p.externalId] : []));
  const stores = [...new Set(pubs.map((p) => p.storeId))];
  const found = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT s.id, s."orderedAt"
    FROM sales s
    CROSS JOIN LATERAL jsonb_array_elements(s.lines) l
    WHERE s."storeId" = ANY(${stores}) AND (l->>'publicationId' = ANY(${ids}) OR l->>'listingId' = ANY(${codes}))
    ORDER BY s."orderedAt" DESC`;
  const reader = await db.saleReader.findFirst({ where: { storeId: { in: stores }, historyFrom: { not: null } }, orderBy: { historyFrom: 'asc' }, select: { historyFrom: true } });
  const since = reader?.historyFrom ?? null;
  if (found.length === 0) return { ...empty, since };
  const raw = await db.sale.findMany({ where: { id: { in: found.map((f) => f.id) } }, orderBy: { orderedAt: 'desc' }, select: ROW_SELECT });
  const rows = await shape(db, accountId, raw);
  const mine = (l: SaleLineRow) => (l.publicationId !== null && ids.includes(l.publicationId)) || codes.includes(l.listingId);
  const summary = { ...empty.summary, currency: rows[0]?.currency ?? 'ARS' };
  let profit = 0;
  for (const r of rows) {
    if (r.state === 'CANCELLED') {
      summary.cancelled++;
      continue;
    }
    if (r.state === 'PENDING') continue;
    const own = r.lines.filter(mine);
    const value = own.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const all = r.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    summary.count++;
    summary.units += own.reduce((s, l) => s + l.quantity, 0);
    summary.sold += value;
    if (r.money.profit === null) summary.withoutCost++;
    else profit += all > 0 ? (r.money.profit * value) / all : r.money.profit;
  }
  summary.sold = Math.round(summary.sold * 100) / 100;
  summary.profit = summary.count > summary.withoutCost ? Math.round(profit * 100) / 100 : null;
  return { rows: rows.slice(0, take), total: rows.length, summary, since };
}

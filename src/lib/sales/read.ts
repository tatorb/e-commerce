import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind, SaleShipState, SaleState } from '@/generated/prisma/enums';
import { ConnectError } from '@/channels/connect';
import {
  getChannelSalesLedger,
  SalesAccessError,
  type ChannelPaymentMoney,
  type ChannelSaleRecord,
  type ChannelSalesLedger,
  type ChannelShipment,
  type ChannelShipState,
} from '@/channels/sales';
import { matchSlot, NO_MEASURE, stockSlots, unitParts } from '@/domain/stock';
import { searchTextOf, splitShipping } from '@/domain/sales';
import { withAccessToken } from '@/lib/connections';
import { listingOwners, soldMeasure, soldPublication } from '@/lib/stock';
import { sourceOf } from '@/lib/stock-plan';

// La lectura de las ventas para la sección Ventas: las que cambiaron desde la
// última vez, las de los últimos 12 meses por tandas, y el envío y el pago de
// cada una. Es aparte del stock (src/lib/stock.ts): guardar acá no descuenta
// nada. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Cuánto para atrás se traen las ventas viejas, y de a cuántos días cada tramo.
export const HISTORY_DAYS = 365;
const WINDOW_DAYS = 10;
const PAGE = 50;
// Mientras un pedido lee, los demás esperan; si se corta, el próximo sigue.
const LEASE_MS = 90_000;
// Las que cambiaron: se mira también una hora antes de la última vez.
const CHANGED_MARGIN_MS = 3600_000;
// Las de más de esto se completan con el costo del envío solo: ya se entregaron y se cobraron.
export const RECENT_DAYS = 60;
// Las abiertas se vuelven a mirar cada tanto, hasta que se entregan o se cobran.
const RECHECK_EVERY_MS = 3 * 3600_000;
// De a cuántas se completan a la vez.
const PARALLEL = 4;

const DAY = 86_400_000;

/** Una línea como queda guardada: lo del canal y de qué publicación, producto y medida es. */
export type SaleLineRow = {
  listingId: string;
  variationId: string | null;
  sku: string | null;
  title: string | null;
  quantity: number;
  unitPrice: number;
  listPrice: number | null;
  fee: number | null;
  publicationId: string | null;
  productId: string | null;
  // La medida del producto, con la clave del stock y del costo. Null si no se sabe.
  key: string | null;
  measure: string | null;
  // En un combo: lo que lleva de cada pieza por unidad, para el costo si el combo no tiene el suyo.
  parts?: { productId: string; key: string; quantity: number }[];
};

export type SalePaymentRow = ChannelSaleRecord['payments'][number] & { net?: number | null; releaseAt?: string | null; released?: boolean | null };

export function parseLines(raw: unknown): SaleLineRow[] {
  return Array.isArray(raw) ? (raw as SaleLineRow[]).filter((l) => l && typeof l === 'object' && typeof l.listingId === 'string') : [];
}

export function parsePayments(raw: unknown): SalePaymentRow[] {
  return Array.isArray(raw) ? (raw as SalePaymentRow[]).filter((p) => p && typeof p === 'object' && typeof p.id === 'string') : [];
}

const STATE: Record<ChannelSaleRecord['state'], SaleState> = { pending: 'PENDING', paid: 'PAID', cancelled: 'CANCELLED' };
const SHIP: Record<ChannelShipState, SaleShipState> = {
  none: 'NONE',
  pending: 'PENDING',
  to_ship: 'TO_SHIP',
  shipped: 'SHIPPED',
  delivered: 'DELIVERED',
  not_delivered: 'NOT_DELIVERED',
  returned: 'RETURNED',
  cancelled: 'CANCELLED',
};

const toDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dec = (n: number | null | undefined) => (n === null || n === undefined ? null : new Prisma.Decimal(Math.round(n * 100) / 100));

// ───────────────────────────── Guardar ─────────────────────────────

/** Completa en la línea de qué publicación, producto y medida es. Devuelve lo que se busca de ese producto. */
async function linkLine(db: Db, storeId: string, row: SaleLineRow, owners: () => Promise<Map<string, string>>): Promise<(string | null)[]> {
  const pub = await soldPublication(db, storeId, row.listingId, owners);
  if (!pub) return [];
  const measure = soldMeasure(pub, row);
  const slots = stockSlots(pub.product.variants);
  const key = slots.length === 1 ? NO_MEASURE : measure ? matchSlot(slots, measure) : null;
  row.publicationId = pub.id;
  row.productId = pub.product.id;
  row.key = key;
  row.measure = key ? (slots.find((s) => s.key === key)?.label ?? null) : null;
  if (pub.product.kind === 'COMBO') row.parts = unitParts(sourceOf(pub.product), measure) ?? undefined;
  return [pub.product.name, pub.title, pub.externalId, ...pub.product.variants.map((v) => v.sku)];
}

/**
 * Las ventas con líneas de publicaciones que no estaban en la app: si ya
 * están, las une a su publicación, producto y medida, para el costo y la
 * búsqueda. Devuelve cuántas ventas cambiaron.
 */
export async function relinkSaleLines(db: Db, storeId: string, listingIds: string[]): Promise<number> {
  if (listingIds.length === 0) return 0;
  const sales = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT s.id FROM sales s, jsonb_array_elements(s.lines) l
    WHERE s."storeId" = ${storeId} AND l->>'listingId' = ANY(${listingIds}) AND (l->>'publicationId') IS NULL`;
  const owners = listingOwners(db, storeId);
  let changed = 0;
  for (const { id } of sales) {
    const sale = await db.sale.findUniqueOrThrow({ where: { id }, select: { lines: true, searchText: true } });
    const lines = parseLines(sale.lines);
    const words: (string | null)[] = [];
    for (const row of lines) if (!row.publicationId) words.push(...(await linkLine(db, storeId, row, owners)));
    if (words.length === 0) continue;
    await db.sale.update({
      where: { id },
      data: { lines: lines as unknown as Prisma.InputJsonValue, searchText: searchTextOf([sale.searchText, ...words]) },
    });
    changed++;
  }
  return changed;
}

/** De qué publicación, producto y medida es cada línea vendida, y lo que se busca de esos productos. */
async function resolveLines(db: Db, storeId: string, rec: ChannelSaleRecord, owners: () => Promise<Map<string, string>>) {
  const words: (string | null)[] = [];
  const lines: SaleLineRow[] = [];
  for (const line of rec.lines) {
    const row: SaleLineRow = {
      listingId: line.listingId,
      variationId: line.variationId,
      sku: line.sku,
      title: line.title,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      listPrice: line.listPrice,
      fee: line.fee,
      publicationId: null,
      productId: null,
      key: null,
      measure: null,
    };
    words.push(...(await linkLine(db, storeId, row, owners)));
    words.push(line.title, line.sku, line.listingId);
    lines.push(row);
  }
  return { lines, words };
}

/** Lo que va en la venta de lo que trae la venta del canal, sin el envío ni lo del medio de pago. */
function orderData(rec: ChannelSaleRecord, lines: SaleLineRow[], words: (string | null)[], previous: SalePaymentRow[]) {
  const fees = lines.map((l) => l.fee);
  const listAmount = lines.every((l) => l.listPrice !== null) && lines.length > 0 ? lines.reduce((s, l) => s + l.listPrice! * l.quantity, 0) : null;
  // Lo que ya se leyó del medio de pago se conserva en cada pago.
  const payments: SalePaymentRow[] = rec.payments.map((p) => {
    const before = previous.find((x) => x.id === p.id);
    return before ? { ...p, net: before.net, releaseAt: before.releaseAt, released: before.released } : p;
  });
  return {
    packId: rec.packId,
    state: STATE[rec.state],
    orderedAt: new Date(rec.order.orderedAt),
    closedAt: toDate(rec.closedAt),
    currency: rec.currency,
    itemsAmount: dec(rec.itemsAmount)!,
    listAmount: dec(listAmount),
    fee: fees.length > 0 && fees.every((f) => f !== null) ? dec(fees.reduce((s, f) => s! + f!, 0)) : null,
    paidAmount: dec(rec.paidAmount),
    buyerId: rec.buyer.id,
    buyerNickname: rec.buyer.nickname,
    buyerName: rec.buyer.name,
    lines: lines as unknown as Prisma.InputJsonValue,
    payments: payments as unknown as Prisma.InputJsonValue,
    paymentIds: payments.map((p) => p.id),
    shipmentId: rec.shipmentId,
    claim: rec.claim,
    cancelBy: rec.cancel?.by ?? null,
    cancelReason: rec.cancel?.reason ?? null,
    delivered: rec.order.delivered,
    searchText: searchTextOf([rec.order.orderId, rec.packId, rec.buyer.nickname, rec.buyer.name, ...words]),
  };
}

/**
 * Guarda las ventas como las informa el canal. Si cambió algo del envío o del
 * pago, se vuelven a leer. Devuelve cuántas eran nuevas.
 */
export async function saveSales(db: Db, storeId: string, records: ChannelSaleRecord[], now: Date): Promise<{ added: number; ids: string[] }> {
  const owners = listingOwners(db, storeId);
  let added = 0;
  const ids: string[] = [];
  for (const rec of records) {
    const existing = await db.sale.findUnique({
      where: { storeId_orderId: { storeId, orderId: rec.order.orderId } },
      select: { id: true, state: true, shipmentId: true, payments: true, delivered: true, claim: true },
    });
    const { lines, words } = await resolveLines(db, storeId, rec, owners);
    const data = orderData(rec, lines, words, parsePayments(existing?.payments));
    // Entregada no vuelve atrás: el envío puede saberlo antes que la venta.
    data.delivered ||= existing?.delivered ?? false;
    // Lo que cambia el envío o el pago: se vuelven a leer.
    const changed =
      !existing ||
      existing.state !== data.state ||
      existing.shipmentId !== data.shipmentId ||
      existing.delivered !== data.delivered ||
      existing.claim !== data.claim ||
      parsePayments(existing.payments)
        .map((p) => `${p.id}:${p.state}`)
        .join() !== rec.payments.map((p) => `${p.id}:${p.state}`).join();
    try {
      const row = await db.sale.upsert({
        where: { storeId_orderId: { storeId, orderId: rec.order.orderId } },
        create: { storeId, orderId: rec.order.orderId, ...data, checkedAt: now, ...noShipment(data.shipmentId, rec) },
        update: { ...data, checkedAt: now, ...(changed ? { detailsAt: null } : {}) },
        select: { id: true },
      });
      ids.push(row.id);
      if (!existing) added++;
    } catch (e) {
      // Llegó dos veces a la vez: la otra ya la guardó.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
      throw e;
    }
  }
  return { added, ids };
}

/** Sin envío del canal no hay nada que leer del envío. */
function noShipment(shipmentId: string | null, rec: ChannelSaleRecord) {
  return shipmentId ? {} : { shipState: 'NONE' as const, shipKind: 'none', delivered: rec.order.delivered };
}

// ───────────────────────────── El envío y el pago ─────────────────────────────

/** El envío en todas las ventas que lo comparten, como un carrito: cada una con su parte del costo. */
async function applyShipment(db: Db, storeId: string, s: ChannelShipment): Promise<void> {
  const sales = await db.sale.findMany({ where: { storeId, shipmentId: s.shipmentId }, orderBy: { orderId: 'asc' }, select: { id: true, itemsAmount: true } });
  if (sales.length === 0) return;
  const amounts = sales.map((x) => Number(x.itemsAmount));
  const seller = s.sellerCost === null ? null : splitShipping(s.sellerCost, amounts);
  const buyer = s.buyerCost === null ? null : splitShipping(s.buyerCost, amounts);
  for (const [i, sale] of sales.entries()) {
    await db.sale.update({
      where: { id: sale.id },
      data: {
        shipState: SHIP[s.state],
        shipDetail: s.detail,
        shipKind: s.kind,
        shipKindLabel: s.kindLabel,
        tracking: s.tracking,
        dispatchBy: toDate(s.dispatchBy),
        estimatedAt: toDate(s.estimatedAt),
        shippedAt: toDate(s.shippedAt),
        deliveredAt: toDate(s.deliveredAt),
        shipDelayed: s.delayed,
        shippingCost: seller ? dec(seller[i]) : null,
        buyerShipping: buyer ? dec(buyer[i]) : null,
        ...(s.state === 'delivered' ? { delivered: true } : {}),
      },
    });
  }
}

/** Lo del medio de pago en la venta: lo que deposita entre todos sus pagos, cuándo se libera y lo devuelto. */
async function applyPayments(db: Db, saleId: string, money: ChannelPaymentMoney[]): Promise<void> {
  const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId }, select: { payments: true } });
  const payments = parsePayments(sale.payments).map((p) => {
    const m = money.find((x) => x.id === p.id);
    return m ? { ...p, net: m.net, releaseAt: m.releaseAt, released: m.released } : p;
  });
  // Solo los aprobados llevan plata.
  const paid = payments.filter((p) => p.state === 'approved' || p.state === 'refunded');
  const read = paid.filter((p) => money.some((m) => m.id === p.id));
  const known = read.length > 0 && read.length === paid.length;
  const nets = paid.map((p) => p.net);
  const dates = paid.map((p) => toDate(p.releaseAt)).filter((d): d is Date => d !== null);
  await db.sale.update({
    where: { id: saleId },
    data: {
      payments: payments as unknown as Prisma.InputJsonValue,
      netReceived: known && nets.every((n) => typeof n === 'number') ? dec(nets.reduce((s, n) => s! + n!, 0)) : null,
      releaseAt: known && dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
      released: known ? (paid.every((p) => p.released === true) ? true : paid.some((p) => p.released === false) ? false : null) : null,
      refunded: known ? dec(money.reduce((s, m) => s + m.refunded, 0)) : null,
    },
  });
}

type DetailRow = { id: string; orderId: string; state: SaleState; shipmentId: string | null; paymentIds: string[]; orderedAt: Date; delivered: boolean; shipState: SaleShipState };

/**
 * Completa una venta: la vuelve a leer si puede haberse cancelado, el envío y
 * el pago. Las viejas, ya entregadas, solo con el costo del envío.
 */
async function completeSale(db: Db, ledger: ChannelSalesLedger, token: string, storeId: string, s: DetailRow, now: Date): Promise<void> {
  const old = now.getTime() - s.orderedAt.getTime() > RECENT_DAYS * DAY;
  if (old && (s.delivered || s.state === 'CANCELLED')) {
    if (s.shipmentId && s.state !== 'CANCELLED') {
      const cost = await ledger.readShippingCost(token, s.shipmentId);
      const sales = await db.sale.findMany({ where: { storeId, shipmentId: s.shipmentId }, orderBy: { orderId: 'asc' }, select: { id: true, itemsAmount: true } });
      const seller = cost?.sellerCost != null ? splitShipping(cost.sellerCost, sales.map((x) => Number(x.itemsAmount))) : null;
      for (const [i, x] of sales.entries()) {
        await db.sale.update({
          where: { id: x.id },
          data: { shipState: s.delivered ? 'DELIVERED' : undefined, shippingCost: seller ? dec(seller[i]) : null },
        });
      }
    }
    // Hace más de dos meses que se entregó: la plata ya se liberó, sin la fecha exacta.
    await db.sale.update({
      where: { id: s.id },
      data: { detailsAt: now, ...(s.state === 'PAID' && s.delivered ? { released: true } : {}) },
    });
    return;
  }
  // Si sigue abierta, la venta puede haberse cancelado: el buscador no devuelve las canceladas.
  let current = s;
  if (s.state !== 'CANCELLED' && !s.delivered) {
    const rec = await ledger.readSale(token, s.orderId);
    if (rec) {
      await saveSales(db, storeId, [rec], now);
      current = (await db.sale.findUniqueOrThrow({ where: { id: s.id }, select: DETAIL_SELECT })) as DetailRow;
    }
  }
  if (current.shipmentId) {
    const shipment = await ledger.readShipment(token, current.shipmentId);
    if (shipment) await applyShipment(db, storeId, shipment);
  }
  if (current.state !== 'CANCELLED' && current.paymentIds.length > 0) {
    const money: ChannelPaymentMoney[] = [];
    for (const pid of current.paymentIds) {
      const m = await ledger.readPayment(token, pid);
      if (m) money.push(m);
    }
    await applyPayments(db, current.id, money);
  }
  await db.sale.update({ where: { id: s.id }, data: { detailsAt: now } });
}

/**
 * Completa la venta; si el canal falla con esa sola, queda para dentro de un
 * rato y siguen las demás. Si hay que volver a conectar o el canal pide
 * esperar, se corta todo.
 */
async function completeOrPostpone(db: Db, ledger: ChannelSalesLedger, token: string, storeId: string, s: DetailRow, now: Date): Promise<void> {
  try {
    await completeSale(db, ledger, token, storeId, s, now);
  } catch (e) {
    if (!(e instanceof ConnectError) || e.reauth || e.busy) throw e;
    console.error('No se pudo completar la venta', s.orderId, e.message);
    await db.sale.update({ where: { id: s.id }, data: { detailsAt: now } });
  }
}

const DETAIL_SELECT = { id: true, orderId: true, state: true, shipmentId: true, paymentIds: true, orderedAt: true, delivered: true, shipState: true } as const;

const OPEN_SHIP: SaleShipState[] = ['PENDING', 'TO_SHIP', 'SHIPPED', 'NOT_DELIVERED'];

/** Las que falta completar: las nuevas o cambiadas primero, después las abiertas que hace rato no se miran. */
async function toComplete(db: Db, storeId: string, now: Date, take: number): Promise<DetailRow[]> {
  const fresh = await db.sale.findMany({ where: { storeId, detailsAt: null }, orderBy: { orderedAt: 'desc' }, take, select: DETAIL_SELECT });
  if (fresh.length >= take) return fresh;
  const stale = await db.sale.findMany({
    where: {
      storeId,
      detailsAt: { lt: new Date(now.getTime() - RECHECK_EVERY_MS) },
      orderedAt: { gte: new Date(now.getTime() - RECENT_DAYS * DAY) },
      state: { not: 'CANCELLED' },
      // Sin liberar: también las que no tienen el dato (null).
      OR: [{ shipState: { in: OPEN_SHIP } }, { state: 'PAID', released: null }, { state: 'PAID', released: false }],
    },
    orderBy: { detailsAt: 'asc' },
    take: take - fresh.length,
    select: DETAIL_SELECT,
  });
  return [...fresh, ...stale];
}

// ───────────────────────────── La lectura de una tienda ─────────────────────────────

export type SalesReadResult = {
  status: 'done' | 'pending' | 'busy' | 'failed';
  read: number;
  added: number;
  completed: number;
  error?: string;
};

/** Toma la lectura de la tienda. False si otro pedido la está leyendo. */
async function takeLease(db: Db, storeId: string, now: Date): Promise<boolean> {
  await db.saleReader.upsert({ where: { storeId }, create: { storeId }, update: {} });
  const r = await db.saleReader.updateMany({
    where: { storeId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
  });
  return r.count === 1;
}

/**
 * Lee las ventas de una tienda con lo que queda de tiempo: las que cambiaron,
 * un tramo más de las viejas y las que falta completar. Sigue donde quedó.
 */
export async function readStoreSales(db: Db, storeId: string, opts: { budgetMs: number; now?: () => Date }): Promise<SalesReadResult> {
  const clock = opts.now ?? (() => new Date());
  const started = Date.now();
  const left = () => opts.budgetMs - (Date.now() - started);
  const result: SalesReadResult = { status: 'done', read: 0, added: 0, completed: 0 };
  const store = await db.store.findUnique({ where: { id: storeId }, select: { channel: { select: { kind: true } } } });
  const ledger = store ? getChannelSalesLedger(store.channel.kind) : null;
  if (!ledger) return result;
  const begun = clock();
  if (!(await takeLease(db, storeId, begun))) return { ...result, status: 'busy' };
  let pending = false;
  let lastError: string | null = null;
  try {
    const reader = await db.saleReader.findUniqueOrThrow({ where: { storeId } });
    // La primera vez: las viejas son de los últimos 12 meses hasta ahora; las de después, las trae la lectura de las que cambiaron.
    if (!reader.historyFrom) {
      const from = new Date(begun.getTime() - HISTORY_DAYS * DAY);
      Object.assign(
        reader,
        await db.saleReader.update({
          where: { storeId },
          data: { historyFrom: from, historyCursor: from, historyOffset: 0, historyUntil: begun, updatedUntil: begun },
        }),
      );
    }
    const save = async (records: ChannelSaleRecord[]) => {
      const r = await saveSales(db, storeId, records, clock());
      result.read += records.length;
      result.added += r.added;
    };
    await withAccessToken(db, storeId, async (token, sellerId) => {
      // 1. Las que cambiaron desde la última vez.
      const since = new Date((reader.updatedUntil ?? begun).getTime() - CHANGED_MARGIN_MS);
      let finished = true;
      for (let offset = 0; ; ) {
        if (left() <= 0) {
          finished = false;
          break;
        }
        const page = await ledger.searchSales(token, sellerId, { changedSince: since, offset, limit: PAGE });
        await save(page.sales);
        offset += page.sales.length;
        if (page.end || page.sales.length === 0) break;
      }
      if (finished) await db.saleReader.update({ where: { storeId }, data: { updatedUntil: begun } });
      else pending = true;

      // 2. Las viejas, por tramos de días. Sigue donde quedó.
      let cursor = reader.historyCursor;
      let offset = reader.historyOffset;
      const until = reader.historyUntil ?? begun;
      while (cursor && cursor < until) {
        if (left() <= 0) {
          pending = true;
          break;
        }
        const to = new Date(Math.min(cursor.getTime() + WINDOW_DAYS * DAY, until.getTime()));
        const page = await ledger.searchSales(token, sellerId, { createdFrom: cursor, createdTo: to, offset, limit: PAGE });
        await save(page.sales);
        if (page.end || page.sales.length === 0) {
          cursor = to;
          offset = 0;
        } else offset += page.sales.length;
        const done = cursor >= until;
        await db.saleReader.update({
          where: { storeId },
          data: { historyCursor: done ? null : cursor, historyOffset: offset, ...(done ? { historyDoneAt: clock() } : {}) },
        });
        if (done) cursor = null;
      }

      // 3. El envío y el pago de las que falta completar, de a varias a la vez.
      for (;;) {
        if (left() <= 0) {
          pending = true;
          break;
        }
        const batch = await toComplete(db, storeId, clock(), PARALLEL * 3);
        if (batch.length === 0) break;
        for (let i = 0; i < batch.length; i += PARALLEL) {
          if (left() <= 0) {
            pending = true;
            break;
          }
          await Promise.all(batch.slice(i, i + PARALLEL).map((s) => completeOrPostpone(db, ledger, token, storeId, s, clock())));
          result.completed += Math.min(PARALLEL, batch.length - i);
        }
        if (pending) break;
      }
    });
  } catch (e) {
    if (e instanceof SalesAccessError || e instanceof ConnectError) {
      lastError = e.message;
      result.status = 'failed';
      result.error = e.message;
    } else {
      lastError = `No se pudieron leer las ventas. Se vuelve a probar en la próxima lectura. Detalle: ${e instanceof Error ? e.message : String(e)}`;
      throw e;
    }
  } finally {
    await db.saleReader.update({ where: { storeId }, data: { leaseUntil: null, readAt: clock(), lastError } });
  }
  if (result.status === 'done' && pending) result.status = 'pending';
  return result;
}

/** Las tiendas conectadas de un canal que deja leer sus ventas, de una cuenta o de todas. */
export async function salesStores(db: Db, accountId?: string) {
  const stores = await db.store.findMany({
    where: { connection: { status: 'ACTIVE' }, ...(accountId ? { accountId } : {}) },
    select: { id: true, name: true, accountId: true, channel: { select: { kind: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return stores.filter((s) => getChannelSalesLedger(s.channel.kind) !== null);
}

/** La lectura programada: las ventas de todas las tiendas, o de una cuenta, con lo que queda de tiempo. */
export async function readAllSales(db: Db, opts: { budgetMs: number; accountId?: string; now?: () => Date }): Promise<{ pending: boolean; read: number; added: number; completed: number }> {
  const started = Date.now();
  const out = { pending: false, read: 0, added: 0, completed: 0 };
  for (const store of await salesStores(db, opts.accountId)) {
    const left = opts.budgetMs - (Date.now() - started);
    if (left <= 0) return { ...out, pending: true };
    try {
      const r = await readStoreSales(db, store.id, { budgetMs: left, now: opts.now });
      out.read += r.read;
      out.added += r.added;
      out.completed += r.completed;
      if (r.status === 'pending' || r.status === 'busy') out.pending = true;
    } catch (e) {
      console.error('No se pudieron leer las ventas', store.id, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

// ───────────────────────────── Los avisos del canal ─────────────────────────────

/**
 * El aviso del canal de que una venta, un envío o un pago cambió. No se
 * confía en lo que trae: solo se toma el código y se lo pide al canal con la
 * conexión de la tienda. Devuelve cuántas ventas se actualizaron.
 */
export async function handleSaleNotice(db: Db, kind: ChannelKind, body: unknown, now = new Date()): Promise<number> {
  const ledger = getChannelSalesLedger(kind);
  const notice = ledger?.parseSaleNotice(body);
  if (!ledger || !notice) return 0;
  const connections = await db.channelConnection.findMany({
    where: { status: 'ACTIVE', externalUserId: notice.userId, store: { channel: { kind } }, ...(notice.appId ? { appId: notice.appId } : {}) },
    select: { storeId: true },
  });
  let updated = 0;
  for (const { storeId } of connections) {
    await db.saleReader.upsert({ where: { storeId }, create: { storeId, noticeAt: now }, update: { noticeAt: now } });
    try {
      await withAccessToken(db, storeId, async (token) => {
        if (notice.kind === 'order') {
          const rec = await ledger.readSale(token, notice.id);
          if (!rec || (rec.order.sellerId && rec.order.sellerId !== notice.userId)) return;
          const { ids } = await saveSales(db, storeId, [rec], now);
          for (const id of ids) {
            const row = await db.sale.findUniqueOrThrow({ where: { id }, select: DETAIL_SELECT });
            await completeSale(db, ledger, token, storeId, row as DetailRow, now);
            updated++;
          }
          return;
        }
        if (notice.kind === 'shipment') {
          const known = await db.sale.count({ where: { storeId, shipmentId: notice.id } });
          if (known === 0) return;
          const shipment = await ledger.readShipment(token, notice.id);
          if (shipment) {
            await applyShipment(db, storeId, shipment);
            updated += known;
          }
          return;
        }
        const sale = await db.sale.findFirst({ where: { storeId, paymentIds: { has: notice.id } }, select: { id: true, paymentIds: true } });
        if (!sale) return;
        const money: ChannelPaymentMoney[] = [];
        for (const pid of sale.paymentIds) {
          const m = await ledger.readPayment(token, pid);
          if (m) money.push(m);
        }
        await applyPayments(db, sale.id, money);
        updated++;
      });
    } catch (e) {
      console.error('No se pudo leer la venta del aviso', e instanceof Error ? e.message : e);
    }
  }
  return updated;
}

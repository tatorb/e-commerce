import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { ConnectError } from '@/channels/connect';
import { getChannelPublisher, PublishError } from '@/channels/publish';
import { getChannelSales, SalesAccessError, type ChannelOrder, type ChannelOrderLine } from '@/channels/sales';
import { fingerprint, parseFingerprints, parseRejections } from '@/domain/channel-sync';
import { parseVariantListings, parseVariations, type VariantLike } from '@/domain/media';
import { channelQuantities } from '@/domain/quantities';
import { copySkus, initialStock, isManaged, listingMeasure, observedStock, parseStockChange, StockError, stockSlots, unitParts } from '@/domain/stock';
import { titleOrUntitled } from '@/domain/publication-title';
import { needsReactivation } from '@/domain/channel-status';
import { quantityCopy, sendQuantities } from '@/lib/channel-push';
import { withAccessToken } from '@/lib/connections';
import { variantListingOwners } from '@/lib/variant-listings';
import { afterRestock } from '@/lib/restock';
import { PLAN_SELECT, planFor, singleMeasure, SOURCE_SELECT, sourceOf, type PlanRow, type StockPlan } from '@/lib/stock-plan';

// El stock de cada producto: cargarlo a mano, tomarlo del canal al empezar,
// descontar las ventas, devolver las canceladas y subir la cantidad que le
// toca a cada publicación. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

// Las ventas que se miran de nuevo para saber si se cancelaron: las de este tiempo para atrás.
const RECHECK_DAYS = 30;
// Cada cuánto se vuelve a mirar una venta contada.
const RECHECK_EVERY_MS = 3 * 3600_000;
// Cuántas se vuelven a mirar por pasada.
const RECHECK_MAX = 15;
// Lo más que trae la pasada de las ventas de cada tienda.
const SWEEP_MAX = 200;
// Al revisar las ventas, se mira también una hora antes de la última vez.
const SWEEP_MARGIN_MS = 3600_000;

const SOLD_TOO_MUCH = 'Se vendió más de lo que había en el stock: revisalo.';
const KEPT_NOTE = 'Se canceló una venta que ya se había entregado: si la pieza vuelve, sumala a mano.';

/** Suma (o resta) al stock de una medida, de una sola vez aunque lleguen dos ventas juntas. Devuelve cuánto quedó. */
async function addStock(tx: Tx, productId: string, key: string, label: string, delta: number): Promise<number> {
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    INSERT INTO product_stock ("productId", key, label, quantity, "updatedAt")
    VALUES (${productId}, ${key}, ${label}, ${delta}, now())
    ON CONFLICT ("productId", key) DO UPDATE SET quantity = product_stock.quantity + ${delta}, "updatedAt" = now()
    RETURNING quantity`;
  return rows[0].quantity;
}

// ───────────────────────────── Subir lo que le toca a cada publicación ─────────────────────────────

/** Las publicaciones que muestran el stock de esos productos: las suyas y las de los combos en que están. */
export async function affectedPublications(db: Db | Tx, productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];
  const rows = await db.publication.findMany({
    where: { OR: [{ productId: { in: productIds } }, { product: { comboItems: { some: { productId: { in: productIds } } } } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Si el último intento que no salió fue este mismo: así la pasada de cada hora no llena el registro. */
async function sameRejection(db: Db, publicationId: string, message: string): Promise<boolean> {
  const last = await db.channelSyncChange.findFirst({
    where: { publicationId, field: 'quantity' },
    orderBy: { createdAt: 'desc' },
    select: { kind: true, message: true, createdAt: true },
  });
  return last?.kind === 'REJECTED' && last.message === message && Date.now() - last.createdAt.getTime() < 24 * 3600_000;
}

/** Sube las cantidades de la publicación y deja la cara del canal con ellas. */
async function pushPlanned(
  db: Db,
  row: PlanRow,
  plan: Extract<StockPlan, { managed: true }>,
  opts: { userId: string | null; note: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const publisher = getChannelPublisher(row.store.channel.kind);
  if (!publisher) return { ok: false, error: `Todavía no se pueden subir cambios a ${row.store.channel.name}.` };
  const connection = await db.channelConnection.findUnique({ where: { storeId: row.store.id }, select: { status: true } });
  if (connection?.status !== 'ACTIVE') return { ok: false, error: `La tienda no está conectada con ${row.store.channel.name}.` };
  try {
    await sendQuantities(db, row, publisher, plan.lines);
  } catch (e) {
    if (e instanceof PublishError) {
      const message = e.message;
      if (!(await sameRejection(db, row.id, message))) {
        await db.channelSyncChange.create({
          data: {
            publicationId: row.id,
            field: 'quantity',
            kind: 'REJECTED',
            before: (plan.channel ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            after: plan.lines as Prisma.InputJsonValue,
            message,
            userId: opts.userId,
          },
        });
      }
      return { ok: false, error: message };
    }
    if (e instanceof ConnectError) return { ok: false, error: e.message };
    throw e;
  }
  const print = fingerprint('quantity', plan.lines);
  await db.$transaction(async (tx) => {
    const current = await tx.channelCopy.findUniqueOrThrow({
      where: { publicationId: row.id },
      select: { fingerprints: true, agreed: true, rejections: true, variations: true },
    });
    const rejections = parseRejections(current.rejections);
    delete rejections.quantity;
    await tx.channelCopy.update({
      where: { publicationId: row.id },
      data: {
        ...quantityCopy(current.variations, plan.lines),
        fingerprints: { ...parseFingerprints(current.fingerprints), quantity: print },
        agreed: { ...parseFingerprints(current.agreed), quantity: print },
        rejections,
      },
    });
    await tx.channelSyncChange.create({
      data: {
        publicationId: row.id,
        field: 'quantity',
        kind: 'SENT',
        before: (plan.channel ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: plan.lines as Prisma.InputJsonValue,
        message: opts.note,
        userId: opts.userId,
      },
    });
    // Sin borrador propio: la cantidad sale del stock.
    await tx.publication.update({ where: { id: row.id }, data: { quantities: Prisma.DbNull } });
  });
  // Estaba frenada sin stock y ahora tiene: si el canal no la reactiva solo, una tarea.
  if (needsReactivation(row.channelStatus, plan.channel, plan.lines)) await afterRestock(db, { publicationId: row.id, lines: plan.lines });
  return { ok: true };
}

export type SyncResult = { sent: number; failed: { publicationId: string; title: string; error: string }[]; pending: boolean };

/** Sube a esas publicaciones la cantidad que les toca, solo a las que la tienen distinta en el canal. */
export async function syncStock(
  db: Db,
  args: { publicationIds: string[]; userId?: string | null; note?: string | null; budgetMs?: number },
): Promise<SyncResult> {
  const started = Date.now();
  const result: SyncResult = { sent: 0, failed: [], pending: false };
  if (args.publicationIds.length === 0) return result;
  const rows = await db.publication.findMany({ where: { id: { in: args.publicationIds } }, select: PLAN_SELECT });
  for (const row of rows) {
    const plan = planFor(row);
    if (!plan.managed || !plan.pending) continue;
    if (args.budgetMs !== undefined && Date.now() - started > args.budgetMs) {
      result.pending = true;
      break;
    }
    const r = await pushPlanned(db, row, plan, { userId: args.userId ?? null, note: args.note ?? null });
    if (r.ok) result.sent++;
    else result.failed.push({ publicationId: row.id, title: titleOrUntitled(row.title), error: r.error });
  }
  return result;
}

/**
 * En la tarea de cada hora: las publicaciones que siguen al stock y tienen
 * otra cantidad en el canal, por ejemplo porque alguien la cambió allá o
 * porque una subida no salió.
 */
export async function reconcileStock(db: Db, opts: { budgetMs: number }): Promise<SyncResult> {
  const rows = await db.publication.findMany({
    where: {
      externalId: { not: null },
      followsStock: true,
      store: { salesSince: { not: null }, salesError: null },
      channelCopy: { is: { missingSince: null, stockInChannel: false } },
      OR: [{ product: { stockSince: { not: null } } }, { product: { kind: 'COMBO' } }],
    },
    select: { id: true },
  });
  return syncStock(db, { publicationIds: rows.map((r) => r.id), note: 'Volvió a la cantidad del stock del producto.', budgetMs: opts.budgetMs });
}

// ───────────────────────────── A mano ─────────────────────────────

/** Cambia el stock de un producto. Si todavía no lo llevaba la app, empieza ahora. Después lo sube a sus publicaciones. */
export async function setProductStock(
  db: Db,
  args: { accountId: string; productId: string; userId: string; stock: unknown; now?: Date },
): Promise<{ changed: number; sync: SyncResult }> {
  const product = await db.product.findFirst({
    where: { id: args.productId, accountId: args.accountId },
    select: { id: true, kind: true, stockSince: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } }, stock: true },
  });
  if (!product) throw new StockError('El producto no está en la cuenta.');
  if (product.kind === 'COMBO') throw new StockError('El stock de un combo sale de sus piezas: cambialo en cada una.');
  const slots = stockSlots(product.variants);
  const wanted = parseStockChange(args.stock, slots);
  const starting = product.stockSince === null;
  let changed = 0;
  await db.$transaction(async (tx) => {
    for (const slot of slots) {
      const before = starting ? null : (product.stock.find((s) => s.key === slot.key)?.quantity ?? 0);
      const next = wanted[slot.key] ?? (starting ? 0 : null);
      if (next === null || next === before) continue;
      await tx.productStock.upsert({
        where: { productId_key: { productId: product.id, key: slot.key } },
        create: { productId: product.id, key: slot.key, label: slot.label, quantity: next },
        update: { quantity: next, label: slot.label },
      });
      await tx.stockMovement.create({
        data: { productId: product.id, key: slot.key, kind: starting ? 'INITIAL' : 'MANUAL', delta: next - (before ?? 0), after: next, userId: args.userId, note: starting ? 'Cargado a mano.' : null },
      });
      changed++;
    }
    if (starting) await tx.product.update({ where: { id: product.id }, data: { stockSince: args.now ?? new Date() } });
  });
  const sync = await syncStock(db, {
    publicationIds: await affectedPublications(db, [product.id]),
    userId: args.userId,
    note: 'Por un cambio a mano en el stock del producto.',
  });
  return { changed, sync };
}

/** Ya se revisó lo que había para revisar del stock. */
export async function markStockReviewed(db: Db, args: { accountId: string; productId: string }): Promise<void> {
  await db.product.updateMany({ where: { id: args.productId, accountId: args.accountId }, data: { stockReview: null } });
}

/**
 * Prende o apaga la cantidad automática de una publicación. Al prenderla, le
 * sube enseguida la cantidad que le toca; apagada, la app no la toca más.
 */
export async function setFollowsStock(
  db: Db,
  args: { accountId: string; publicationId: string; on: boolean; userId: string | null },
): Promise<{ plan: StockPlan; sync: SyncResult }> {
  const r = await db.publication.updateMany({ where: { id: args.publicationId, product: { accountId: args.accountId } }, data: { followsStock: args.on } });
  if (r.count === 0) throw new StockError('La publicación no está en la cuenta.');
  const sync = args.on
    ? await syncStock(db, { publicationIds: [args.publicationId], userId: args.userId, note: 'Se prendió la cantidad automática.' })
    : { sent: 0, failed: [], pending: false };
  const row = await db.publication.findUniqueOrThrow({ where: { id: args.publicationId }, select: PLAN_SELECT });
  return { plan: planFor(row), sync };
}

// ───────────────────────────── Ventas ─────────────────────────────

type SalePart = { productId: string; key: string; quantity: number };
/** Una línea de la venta como queda guardada. unmanaged: el producto no tenía stock en la app; se cuenta si empieza después. */
type SaleLine = {
  listingId: string;
  variationId: string | null;
  sku: string | null;
  quantity: number;
  publicationId: string | null;
  counted: boolean;
  parts: SalePart[];
  reason?: string;
  unmanaged?: boolean;
};

function parseSaleLines(raw: unknown): SaleLine[] {
  return Array.isArray(raw) ? (raw as SaleLine[]).filter((l) => l && typeof l === 'object' && typeof l.listingId === 'string') : [];
}

/** De qué publicación de la app es la línea, y qué sale del stock. */
async function resolveLine(db: Db | Tx, storeId: string, line: ChannelOrderLine, owners: () => Promise<Map<string, string>>): Promise<SaleLine> {
  const base = { listingId: line.listingId, variationId: line.variationId, sku: line.sku, quantity: line.quantity, parts: [] as SalePart[] };
  let pub = await db.publication.findFirst({ where: { storeId, externalId: line.listingId }, select: PLAN_SELECT });
  if (!pub) {
    const owner = (await owners()).get(line.listingId);
    if (owner) pub = await db.publication.findUnique({ where: { id: owner }, select: PLAN_SELECT });
  }
  if (!pub) return { ...base, publicationId: null, counted: false, reason: 'La publicación no está en la app.' };
  const skip = (reason: string, extra: Partial<SaleLine> = {}): SaleLine => ({ ...base, publicationId: pub!.id, counted: false, reason, ...extra });
  if (pub.channelCopy?.stockInChannel) return skip('El stock lo maneja el canal, por ejemplo en Full.');
  const source = sourceOf(pub.product);
  // La medida vendida: la publicación aparte de la familia, la variante, o el SKU.
  const family = parseVariantListings(pub.variantListings);
  const variations = parseVariations(pub.channelCopy?.variations);
  let measure: VariantLike | null = null;
  const member = family.find((f) => f.externalId === line.listingId);
  if (family.length >= 2 && member) measure = member;
  else if (line.variationId) measure = variations.find((v) => v.variationId === line.variationId) ?? (line.sku ? { sku: line.sku, measure: null } : null);
  else if (line.sku && variations.length > 0) measure = { sku: line.sku, measure: null };
  else if (variations.length === 0) {
    // Una medida publicada sola: la elegida en la publicación, o por el SKU de lo vendido o el de la publicación.
    const slots = stockSlots(pub.product.variants);
    measure =
      singleMeasure(pub.product, null, pub.variantKey) ??
      (line.sku ? listingMeasure(slots, [line.sku]) : null) ??
      listingMeasure(slots, copySkus(pub.channelCopy?.details));
  }
  const unit = unitParts(source, measure);
  if (!unit) return skip('No se sabe de qué medida del producto es.');
  const parts = unit.map((u) => ({ ...u, quantity: u.quantity * line.quantity }));
  if (!isManaged(source)) return skip('El producto todavía no tenía stock en la app.', { parts, unmanaged: true });
  return { ...base, publicationId: pub.id, counted: true, parts };
}

/** El nombre de cada medida, para las filas nuevas del stock. */
async function slotLabel(tx: Tx, productId: string, key: string): Promise<string> {
  const p = await tx.product.findUnique({ where: { id: productId }, select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } });
  return stockSlots(p?.variants ?? []).find((s) => s.key === key)?.label ?? '';
}

/** Descuenta (o devuelve) las unidades de las líneas y lo anota. */
async function moveStock(tx: Tx, lines: SaleLine[], sign: -1 | 1, args: { saleId: string; orderId: string }): Promise<void> {
  for (const line of lines) {
    if (!line.counted) continue;
    for (const part of line.parts) {
      const after = await addStock(tx, part.productId, part.key, await slotLabel(tx, part.productId, part.key), sign * part.quantity);
      await tx.stockMovement.create({
        data: {
          productId: part.productId,
          key: part.key,
          kind: sign < 0 ? 'SALE' : 'CANCEL',
          delta: sign * part.quantity,
          after,
          publicationId: line.publicationId,
          saleId: args.saleId,
          note: `Venta ${args.orderId}`,
        },
      });
      if (after < 0) await tx.product.update({ where: { id: part.productId }, data: { stockReview: SOLD_TOO_MUCH } });
    }
  }
}

const productsOf = (lines: SaleLine[]) => [...new Set(lines.filter((l) => l.counted).flatMap((l) => l.parts.map((p) => p.productId)))];

/**
 * Anota una venta del canal: si se confirmó, descuenta las unidades del stock
 * de sus productos; si después se cancela sin haberse entregado, las devuelve.
 * Cada venta se cuenta una sola vez. Devuelve los productos que cambiaron.
 */
export async function recordOrder(db: Db, args: { storeId: string; order: ChannelOrder; now?: Date }): Promise<string[]> {
  const { order } = args;
  const now = args.now ?? new Date();
  const existing = await db.channelSale.findUnique({ where: { storeId_orderId: { storeId: args.storeId, orderId: order.orderId } } });

  if (!existing) {
    // Todavía no se confirmó, o se canceló antes: el canal no descontó nada.
    if (!order.counts) return [];
    let owners: Map<string, string> | null = null;
    const ownersOf = async () => (owners ??= await variantListingOwners(db, args.storeId));
    const lines: SaleLine[] = [];
    for (const line of order.lines) lines.push(await resolveLine(db, args.storeId, line, ownersOf));
    const counted = lines.some((l) => l.counted);
    try {
      await db.$transaction(async (tx) => {
        const sale = await tx.channelSale.create({
          data: {
            storeId: args.storeId,
            orderId: order.orderId,
            status: counted ? 'COUNTED' : 'SKIPPED',
            lines: lines as Prisma.InputJsonValue,
            orderedAt: new Date(order.orderedAt),
            delivered: order.delivered,
            checkedAt: now,
          },
        });
        await moveStock(tx, lines, -1, { saleId: sale.id, orderId: order.orderId });
      });
    } catch (e) {
      // Llegó dos veces a la vez: la otra ya la anotó.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return [];
      throw e;
    }
    return productsOf(lines);
  }

  const lines = parseSaleLines(existing.lines);
  if (order.cancelled && existing.status === 'COUNTED') {
    const delivered = order.delivered || existing.delivered;
    const changed = await db.$transaction(async (tx) => {
      // Solo una vez, aunque lleguen dos avisos juntos.
      const claimed = await tx.channelSale.updateMany({
        where: { id: existing.id, status: 'COUNTED' },
        data: { status: delivered ? 'KEPT' : 'RETURNED', delivered, checkedAt: now },
      });
      if (claimed.count === 0) return false;
      if (delivered) {
        for (const productId of productsOf(lines)) await tx.product.update({ where: { id: productId }, data: { stockReview: KEPT_NOTE } });
        return false;
      }
      await moveStock(tx, lines, 1, { saleId: existing.id, orderId: order.orderId });
      return true;
    });
    return changed ? productsOf(lines) : [];
  }
  await db.channelSale.update({ where: { id: existing.id }, data: { checkedAt: now, delivered: order.delivered || existing.delivered } });
  return [];
}

/**
 * Las ventas que llegaron cuando el producto todavía no tenía stock en la app
 * y son de después de que empezó: se descuentan ahora.
 */
async function countLate(db: Db, productId: string, since: Date): Promise<void> {
  const sales = await db.channelSale.findMany({
    where: { status: { in: ['SKIPPED', 'COUNTED'] }, orderedAt: { gte: since } },
    select: { id: true, orderId: true, lines: true },
  });
  for (const sale of sales) {
    const lines = parseSaleLines(sale.lines);
    const touched = lines.filter((l) => l.unmanaged && !l.counted && l.parts.some((p) => p.productId === productId));
    if (touched.length === 0) continue;
    // Una línea de un combo se cuenta cuando ya llevan stock todas sus piezas.
    const ids = [...new Set(touched.flatMap((l) => l.parts.map((p) => p.productId)))];
    const ready = new Set((await db.product.findMany({ where: { id: { in: ids }, stockSince: { not: null } }, select: { id: true } })).map((p) => p.id));
    const late = touched.filter((l) => l.parts.every((p) => ready.has(p.productId)));
    if (late.length === 0) continue;
    const next = lines.map((l) => (late.includes(l) ? { ...l, counted: true, unmanaged: false, reason: undefined } : l));
    await db.$transaction(async (tx) => {
      await tx.channelSale.update({ where: { id: sale.id }, data: { status: 'COUNTED', lines: next as Prisma.InputJsonValue } });
      await moveStock(tx, next.filter((_, i) => late.includes(lines[i])), -1, { saleId: sale.id, orderId: sale.orderId });
    });
  }
}

/** Lo que se cambió en la pasada: los productos y si quedó algo. */
type SweepResult = { orders: number; products: string[]; pending: boolean };

/** Las ventas recientes de una tienda, y las contadas que pueden haberse cancelado. */
async function sweepStore(db: Db, store: { id: string; salesCheckedAt: Date | null; channel: { kind: ChannelKind } }, now: Date, deadline: number): Promise<SweepResult> {
  const sales = getChannelSales(store.channel.kind)!;
  const out: SweepResult = { orders: 0, products: [], pending: false };
  const since = new Date((store.salesCheckedAt?.getTime() ?? now.getTime()) - SWEEP_MARGIN_MS);
  const orders = await withAccessToken(db, store.id, (token, sellerId) => sales.recentOrders(token, sellerId, since, SWEEP_MAX));
  // Pudo leerlas: desde ahora sus publicaciones siguen al stock.
  await db.store.update({ where: { id: store.id }, data: { salesCheckedAt: now, salesError: null } });
  await db.store.updateMany({ where: { id: store.id, salesSince: null }, data: { salesSince: now } });
  for (const order of orders) {
    if (Date.now() > deadline) return { ...out, pending: true };
    out.products.push(...(await recordOrder(db, { storeId: store.id, order, now })));
    out.orders++;
  }
  // El buscador del canal no devuelve las canceladas: se vuelve a pedir cada venta contada.
  const recheck = await db.channelSale.findMany({
    where: {
      storeId: store.id,
      status: 'COUNTED',
      delivered: false,
      orderedAt: { gte: new Date(now.getTime() - RECHECK_DAYS * 86_400_000) },
      checkedAt: { lt: new Date(now.getTime() - RECHECK_EVERY_MS) },
    },
    orderBy: { checkedAt: 'asc' },
    take: RECHECK_MAX,
    select: { orderId: true },
  });
  for (const s of recheck) {
    if (Date.now() > deadline) return { ...out, pending: true };
    const order = await withAccessToken(db, store.id, (token) => sales.readOrder(token, s.orderId));
    if (order) out.products.push(...(await recordOrder(db, { storeId: store.id, order, now })));
    else await db.channelSale.updateMany({ where: { storeId: store.id, orderId: s.orderId }, data: { checkedAt: now } });
  }
  return out;
}

/**
 * En la tarea de cada hora: las ventas de cada tienda conectada, o de una, y
 * después la cantidad nueva en las publicaciones de los productos que cambiaron.
 */
export async function readSales(
  db: Db,
  opts: { budgetMs: number; now?: Date; storeId?: string },
): Promise<{ orders: number; sent: number; pending: boolean }> {
  const now = opts.now ?? new Date();
  const deadline = Date.now() + opts.budgetMs;
  const stores = await db.store.findMany({
    where: { connection: { is: { status: 'ACTIVE' } }, ...(opts.storeId ? { id: opts.storeId } : {}) },
    select: { id: true, salesCheckedAt: true, channel: { select: { kind: true } } },
  });
  const products = new Set<string>();
  let orders = 0;
  let pending = false;
  for (const store of stores) {
    if (!getChannelSales(store.channel.kind)) continue;
    if (Date.now() > deadline) {
      pending = true;
      break;
    }
    try {
      const r = await sweepStore(db, store, now, deadline);
      r.products.forEach((p) => products.add(p));
      orders += r.orders;
      pending ||= r.pending;
    } catch (e) {
      if (e instanceof SalesAccessError) {
        await db.store.update({ where: { id: store.id }, data: { salesError: e.message } });
        continue;
      }
      if (e instanceof ConnectError) continue;
      throw e;
    }
  }
  const sync = await syncStock(db, {
    publicationIds: await affectedPublications(db, [...products]),
    note: 'Por una venta en el canal.',
    budgetMs: Math.max(deadline - Date.now(), 1000),
  });
  return { orders, sent: sync.sent, pending: pending || sync.pending };
}

/** Un aviso del canal sobre una venta: se lee, se anota y se sube la cantidad nueva. */
export async function handleSalesNotice(db: Db, kind: ChannelKind, body: unknown, now = new Date()): Promise<{ products: number; sent: number }> {
  const sales = getChannelSales(kind);
  const notice = sales?.parseNotice(body);
  if (!sales || !notice) return { products: 0, sent: 0 };
  const connections = await db.channelConnection.findMany({
    where: { status: 'ACTIVE', externalUserId: notice.userId, store: { channel: { kind } }, ...(notice.appId ? { appId: notice.appId } : {}) },
    select: { storeId: true },
  });
  const products = new Set<string>();
  for (const { storeId } of connections) {
    try {
      const order = await withAccessToken(db, storeId, (token) => sales.readOrder(token, notice.orderId));
      if (!order || (order.sellerId && order.sellerId !== notice.userId)) continue;
      await db.store.updateMany({ where: { id: storeId, salesSince: null }, data: { salesSince: now } });
      await db.store.update({ where: { id: storeId }, data: { salesError: null } });
      (await recordOrder(db, { storeId, order, now })).forEach((p) => products.add(p));
    } catch (e) {
      if (e instanceof SalesAccessError) {
        await db.store.update({ where: { id: storeId }, data: { salesError: e.message } });
        continue;
      }
      console.error('No se pudo leer la venta del aviso', e instanceof Error ? e.message : e);
    }
  }
  const sync = await syncStock(db, { publicationIds: await affectedPublications(db, [...products]), note: 'Por una venta en el canal.' });
  return { products: products.size, sent: sync.sent };
}

// ───────────────────────────── El de partida ─────────────────────────────

/**
 * Empieza a llevar el stock de los productos que todavía no lo tienen, con la
 * cantidad de sus publicaciones en el canal: en cada medida, la más baja. Solo
 * con lo leído después de que la tienda empezó a leer las ventas, así ninguna
 * venta queda afuera.
 */
export async function startStock(db: Db, opts: { budgetMs?: number } = {}): Promise<{ started: number; pending: boolean }> {
  const begun = Date.now();
  // Las que tienen la cantidad automática apagada se cambian a mano: su cantidad no dice el stock.
  const where = {
    externalId: { not: null },
    followsStock: true,
    store: { salesSince: { not: null }, salesError: null },
    channelCopy: { is: { missingSince: null, stockInChannel: false } },
  } satisfies Prisma.PublicationWhereInput;
  let started = 0;
  // De a tandas y en orden, así los que todavía no se pueden empezar no tapan a los demás.
  let after = '';
  for (;;) {
    const products = await db.product.findMany({
      where: { id: { gt: after }, stockSince: null, kind: 'INDIVIDUAL', publications: { some: where } },
      orderBy: { id: 'asc' },
      take: START_PAGE,
      select: {
        id: true,
        variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
        publications: {
          where,
          select: { id: true, variantKey: true, store: { select: { salesSince: true } }, channelCopy: { select: { quantity: true, variations: true, readAt: true, details: true } } },
        },
      },
    });
    for (const product of products) {
      if (opts.budgetMs !== undefined && Date.now() - begun > opts.budgetMs) return { started, pending: true };
      if (await startOne(db, product)) started++;
    }
    if (products.length < START_PAGE) return { started, pending: false };
    after = products[products.length - 1].id;
  }
}

const START_PAGE = 200;

type StartRow = {
  id: string;
  variants: VariantLike[];
  publications: {
    variantKey: string | null;
    store: { salesSince: Date | null };
    channelCopy: { quantity: number | null; variations: unknown; readAt: Date; details: unknown } | null;
  }[];
};

/** El stock de partida de un producto. False si todavía no se puede saber o alguien ya lo cargó. */
async function startOne(db: Db, product: StartRow): Promise<boolean> {
  const slots = stockSlots(product.variants);
  const used = product.publications.filter((p) => p.channelCopy && p.store.salesSince && p.channelCopy.readAt >= p.store.salesSince);
  const observed = used
    .map((p) => {
      const variations = parseVariations(p.channelCopy!.variations);
      const channel = channelQuantities(p.channelCopy!.quantity, variations) ?? [];
      const sole = singleMeasure(product, null, p.variantKey) ?? listingMeasure(slots, copySkus(p.channelCopy!.details));
      return observedStock(slots, channel, variations, sole);
    })
    .filter((o) => Object.keys(o).length > 0);
  if (observed.length === 0) return false;
  const { lines, review } = initialStock(slots, observed);
  const since = new Date(Math.min(...used.map((p) => p.channelCopy!.readAt.getTime())));
  const done = await db.$transaction(async (tx) => {
    // Si mientras tanto alguien lo cargó a mano, queda lo suyo.
    const claimed = await tx.product.updateMany({ where: { id: product.id, stockSince: null }, data: { stockSince: since, stockReview: review } });
    if (claimed.count === 0) return false;
    await tx.productStock.deleteMany({ where: { productId: product.id } });
    await tx.productStock.createMany({ data: lines.map((l) => ({ productId: product.id, key: l.key, label: l.label, quantity: l.quantity })) });
    await tx.stockMovement.createMany({
      data: lines.map((l) => ({ productId: product.id, key: l.key, kind: 'INITIAL' as const, delta: l.quantity, after: l.quantity, note: 'Tomado de sus publicaciones en el canal.' })),
    });
    await tx.publication.updateMany({ where: { productId: product.id }, data: { quantities: Prisma.DbNull } });
    return true;
  });
  if (!done) return false;
  await countLate(db, product.id, since);
  return true;
}

// ───────────────────────────── Para la pantalla ─────────────────────────────

const MOVES_SHOWN = 40;

/** El stock del producto, sus publicaciones con lo que les toca y lo último que pasó. */
export async function loadProductStock(db: Db, args: { accountId: string; productId: string }) {
  const product = await db.product.findFirst({
    where: { id: args.productId, accountId: args.accountId },
    select: {
      ...SOURCE_SELECT,
      stockReview: true,
      stock: { select: { key: true, label: true, quantity: true } },
      inCombos: { select: { quantity: true, combo: { select: { id: true, name: true } } } },
      stockMoves: {
        orderBy: { id: 'desc' },
        take: MOVES_SHOWN,
        select: {
          id: true,
          kind: true,
          key: true,
          delta: true,
          after: true,
          note: true,
          createdAt: true,
          user: { select: { name: true } },
          publication: { select: { id: true, title: true, externalId: true } },
        },
      },
    },
  });
  if (!product) return null;
  const slots = stockSlots(product.variants);
  const stock = new Map(product.stock.map((s) => [s.key, s]));
  const publications = await db.publication.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: 'asc' },
    select: PLAN_SELECT,
  });
  const comboPubs = product.inCombos.length
    ? await db.publication.findMany({ where: { productId: { in: product.inCombos.map((c) => c.combo.id) } }, orderBy: { createdAt: 'asc' }, select: PLAN_SELECT })
    : [];
  const pubView = (p: PlanRow) => ({
    id: p.id,
    title: titleOrUntitled(p.title),
    externalId: p.externalId,
    storeName: p.store.name,
    comboName: p.product.kind === 'COMBO' ? p.product.name : null,
    plan: planFor(p),
  });
  return {
    id: product.id,
    kind: product.kind,
    managed: product.stockSince !== null,
    since: product.stockSince,
    review: product.stockReview,
    lines: slots.map((s) => ({ key: s.key, label: s.label, quantity: stock.get(s.key)?.quantity ?? null })),
    // Stock de medidas que ya no están en la ficha.
    orphans: product.stock.filter((s) => !slots.some((x) => x.key === s.key)),
    parts: product.kind === 'COMBO' ? sourceOf(product) : null,
    publications: [...publications, ...comboPubs].map(pubView),
    moves: product.stockMoves.map((m) => ({ ...m, label: slots.find((s) => s.key === m.key)?.label ?? stock.get(m.key)?.label ?? '' })),
  };
}

export type ProductStockView = NonNullable<Awaited<ReturnType<typeof loadProductStock>>>;

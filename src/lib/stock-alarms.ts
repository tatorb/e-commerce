import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { stockSlots, unitParts } from '@/domain/stock';
import { parseVariations, type VariantLike } from '@/domain/media';
import { quantityKey } from '@/domain/quantities';
import { titleOrUntitled } from '@/domain/publication-title';
import { getChannelAdapter } from '@/channels';
import { PLAN_SELECT, planFor, singleMeasure, sourceOf } from '@/lib/stock-plan';
import {
  alarmLevel,
  CUT_AFTER_MS,
  cushionDeadlines,
  owed,
  owedText,
  REMIND_AFTER_MS,
  saleAlarm,
  SELL_WITHOUT_STOCK,
  SHOWN_WHEN_SHORT,
  type AlarmLevel,
  type SaleAlarm,
} from '@/domain/stock-cushion';
import { dayIn, dueDate, OPEN_STATUSES, TASK_TITLE_MAX } from '@/domain/tasks';
import { formatDateTime } from '@/lib/format';
import { notifyAssigned, notifyTaskAgain } from '@/lib/task-mail';

// Las alarmas de stock de los productos con "Mostrar más de 5"
// (src/domain/stock-cushion.ts): una tarea por medida, para todos los
// administradores, que se crea con el aviso temprano o al venderse la última,
// cambia con cada venta y con el cortafuegos, y se cierra sola al cargar
// stock. Cada aviso sale también por mail. Recibe la base por parámetro para
// poder probarlo.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** La clave de la tarea automática de una medida. */
export const stockAlarmKey = (productId: string, key: string) => `stock:${productId}:${key}`;
const KEY_PREFIX = 'stock:';

/** Un cambio en el stock de una medida: de cuánto a cuánto y por qué. */
export type StockChange = { productId: string; key: string; before: number; after: number; cause: 'sale' | 'cancel' | 'manual' };

/** Lo que hay que avisar después de guardar: qué medida y qué pasó. */
export type AlarmEvent = { productId: string; key: string; kind: SaleAlarm | 'restock' | 'remind' | 'cut' | 'off' };

/**
 * Dentro de la transacción que cambió el stock: deja anotado el estado de la
 * alarma de cada medida de los productos con la opción. Una venta que deja 1
 * anota el aviso temprano; una que deja 0 o menos, desde cuándo falta.
 * Cargar stock, o que vuelva una venta cancelada, lo borra. Cargar 0 a mano
 * dice que no hay: tampoco se muestra 6. Devuelve lo que hay que avisar.
 */
export async function markStockAlarms(tx: Tx, changes: StockChange[], now: Date): Promise<AlarmEvent[]> {
  const events: AlarmEvent[] = [];
  const showsMore = new Map<string, boolean>();
  for (const c of changes) {
    if (!showsMore.has(c.productId)) {
      const p = await tx.product.findUnique({ where: { id: c.productId }, select: { showMore: true } });
      showsMore.set(c.productId, p?.showMore ?? false);
    }
    if (!showsMore.get(c.productId)) continue;
    const where = { productId_key: { productId: c.productId, key: c.key } };
    if (c.cause === 'sale') {
      const alarm = saleAlarm(c.before, c.after);
      if (!alarm) continue;
      const row = await tx.productStock.findUnique({ where, select: { outSince: true, lowAt: true } });
      if (alarm === 'low') await tx.productStock.update({ where, data: { lowAt: row?.lowAt ?? now } });
      else await tx.productStock.update({ where, data: { outSince: row?.outSince ?? now } });
      events.push({ productId: c.productId, key: c.key, kind: alarm });
      continue;
    }
    // Entró stock, o se cargó a mano.
    if (c.after >= 1 || c.cause === 'manual') {
      await tx.productStock.update({ where, data: { outSince: null, remindedAt: null, cutAt: null, ...(c.after === 1 ? {} : { lowAt: null }) } });
      events.push({ productId: c.productId, key: c.key, kind: 'restock' });
    } else {
      // Volvió una venta cancelada, pero sigue faltando.
      events.push({ productId: c.productId, key: c.key, kind: 'restock' });
    }
  }
  return events;
}

// ───────────────────────────── Las tareas y los mails ─────────────────────────────

const STATE_SELECT = {
  key: true,
  label: true,
  quantity: true,
  lowAt: true,
  outSince: true,
  remindedAt: true,
  cutAt: true,
  product: {
    select: {
      id: true,
      name: true,
      showMore: true,
      accountId: true,
      account: { select: { timezone: true } },
      variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
    },
  },
} satisfies Prisma.ProductStockSelect;

type StateRow = Prisma.ProductStockGetPayload<{ select: typeof STATE_SELECT }>;

/** El producto y la medida, como se nombran en la tarea: "Aros de pistón 0.50". */
function whatOf(row: StateRow): string {
  const slots = stockSlots(row.product.variants);
  const label = slots.length > 1 ? (slots.find((s) => s.key === row.key)?.label ?? row.label) : '';
  return label ? `${row.product.name}, medida ${label}` : row.product.name;
}

/** El título y la descripción de la tarea según cómo está la medida. */
export function alarmTaskText(row: StateRow, kind: AlarmEvent['kind']): { title: string; description: string } {
  const tz = row.product.account.timezone;
  const what = whatOf(row);
  const real = row.quantity;
  const missing = owed(real);
  const closing = 'Esta tarea se cierra sola al cargar el stock en el producto.';
  const deadlines = row.outSince ? cushionDeadlines(row.outSince) : null;
  const when = (d: Date) => formatDateTime(d, tz);
  const cut = row.cutAt !== null || real <= -SELL_WITHOUT_STOCK;

  if (!row.outSince && real === 1) {
    return {
      title: `Queda 1: ${what}`,
      description: `Queda 1 unidad de ${what}. En los canales se sigue viendo ${SHOWN_WHEN_SHORT}, así que no se nota. Si se vende esta, la app avisa para reponer. ${closing}`,
    };
  }
  const head = missing > 0 ? owedText(missing).toLowerCase() : 'se vendió la última';
  const parts: string[] = [];
  if (row.outSince) parts.push(`Se quedó sin stock el ${when(row.outSince)}.`);
  if (missing > 0) parts.push(`Se ${missing === 1 ? 'vendió 1' : `vendieron ${missing}`} sin tenerla${missing === 1 ? '' : 's'}: hay que comprar${missing === 1 ? 'la' : 'las'} en fábrica para entregar${missing === 1 ? 'la' : 'las'}.`);
  if (row.cutAt) parts.push(`Pasaron dos días sin reponer: el ${when(row.cutAt)} se pausó en los canales.`);
  else if (real <= -SELL_WITHOUT_STOCK) parts.push(`Ya se vendieron ${SELL_WITHOUT_STOCK} sin tener: no se muestra más ${SHOWN_WHEN_SHORT} y la publicación se pausa en los canales hasta cargar el stock.`);
  else if (deadlines) {
    parts.push(`En los canales se sigue viendo ${SHOWN_WHEN_SHORT} para que no se pause.`);
    if (kind === 'remind') parts.push('Pasó un día sin reponer.');
    else parts.push(`Si no se repone, el ${when(deadlines.remindAt)} sale otro aviso.`);
    parts.push(`El ${when(deadlines.cutAt)} se pausa la publicación.`);
  }
  parts.push(closing);
  const title = cut ? `Reponer y reactivar: ${what}, ${head}` : `Reponer: ${what}, ${head}`;
  return { title: title.slice(0, TASK_TITLE_MAX), description: parts.join(' ') };
}

/** Las publicaciones de la tarea: las del producto y las de sus combos, las primeras. */
async function taskPublications(db: Db, productId: string): Promise<string[]> {
  const rows = await db.publication.findMany({
    where: { OR: [{ productId }, { product: { comboItems: { some: { productId } } } }], channelStatus: { notIn: ['CLOSED', 'DELETED'] } },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Después de guardar: crea, cambia o cierra la tarea de cada medida y avisa
 * por mail. Una alarma nueva avisa; cargar stock solo cambia o cierra la tarea.
 */
export async function announceStockAlarms(db: Db, events: AlarmEvent[], now = new Date()): Promise<void> {
  for (const e of events) {
    try {
      await announceOne(db, e, now);
    } catch (err) {
      // El stock ya quedó guardado: la tarea se arregla en el próximo aviso.
      console.error('No se pudo armar la alarma de stock', err instanceof Error ? err.message : err);
    }
  }
}

async function announceOne(db: Db, e: AlarmEvent, now: Date): Promise<void> {
  const row = await db.productStock.findUnique({ where: { productId_key: { productId: e.productId, key: e.key } }, select: STATE_SELECT });
  if (!row) return;
  const accountId = row.product.accountId;
  const autoKey = stockAlarmKey(e.productId, e.key);
  // Se cierra al cargar stock (2 o más), al cargar 0 a mano (dice que no hay) o al apagar la opción sin nada que entregar.
  const settled = e.kind === 'off' ? row.quantity >= 0 : e.kind === 'restock' && !row.outSince && (row.quantity >= 2 || row.quantity <= 0);
  const notify = e.kind !== 'restock' && e.kind !== 'off';

  const taskId = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${autoKey}))`;
    const open = await tx.task.findFirst({ where: { accountId, autoKey, status: { in: [...OPEN_STATUSES] } }, select: { id: true } });
    if (settled || (e.kind === 'restock' && !row.outSince && row.quantity === 1 && !open)) {
      if (open) await tx.task.update({ where: { id: open.id }, data: { status: 'DONE', doneAt: now } });
      return null;
    }
    const text = alarmTaskText(row, e.kind);
    const cutDay = row.outSince && !row.cutAt ? dueDate(dayIn(cushionDeadlines(row.outSince).cutAt, row.product.account.timezone)) : null;
    const data = {
      title: text.title,
      description: text.description,
      dueOn: cutDay,
      // El aviso es ya: el mail sale ahora, no en la pasada de cada hora.
      ...(notify ? { remindAt: now, remindedAt: now } : {}),
    };
    if (open) {
      await tx.task.update({ where: { id: open.id }, data });
      return { id: open.id, created: false };
    }
    if (!notify) return null;
    const admins = await tx.user.findMany({ where: { isAdmin: true, disabledAt: null }, select: { id: true } });
    if (admins.length === 0) return null;
    const created = await tx.task.create({
      data: {
        accountId,
        ...data,
        autoKey,
        assignees: { create: admins.map((a) => ({ userId: a.id })) },
        publications: { create: (await taskPublications(db, e.productId)).map((publicationId) => ({ publicationId })) },
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  });
  if (!taskId || !notify) return;
  const mail = taskId.created ? notifyAssigned(db, taskId.id) : notifyTaskAgain(db, taskId.id, `${e.kind}-${now.getTime()}`);
  await mail.catch((err) => console.error('No salió el mail de la alarma de stock', err instanceof Error ? err.message : err));
}

// ───────────────────────────── El cortafuegos ─────────────────────────────

export type AlarmPassResult = { reminded: number; cut: string[]; pending: boolean };

/**
 * En la tarea de cada hora: a las medidas que siguen sin stock, otro aviso al
 * día y, a los dos días, la pausa. Devuelve los productos que se pausaron,
 * para subirles la cantidad nueva.
 */
export async function stockAlarmPass(db: Db, opts: { budgetMs: number; now?: Date }): Promise<AlarmPassResult> {
  const now = opts.now ?? new Date();
  const started = Date.now();
  const result: AlarmPassResult = { reminded: 0, cut: [], pending: false };
  const base = { cutAt: null, product: { showMore: true } } satisfies Prisma.ProductStockWhereInput;

  const toCut = await db.productStock.findMany({
    where: { ...base, outSince: { lte: new Date(now.getTime() - CUT_AFTER_MS) } },
    select: { productId: true, key: true },
    take: 100,
  });
  for (const r of toCut) {
    if (Date.now() - started > opts.budgetMs) return { ...result, pending: true };
    await db.productStock.update({ where: { productId_key: r }, data: { cutAt: now } });
    await announceStockAlarms(db, [{ ...r, kind: 'cut' }], now);
    result.cut.push(r.productId);
  }

  const toRemind = await db.productStock.findMany({
    where: { ...base, remindedAt: null, outSince: { lte: new Date(now.getTime() - REMIND_AFTER_MS) } },
    select: { productId: true, key: true },
    take: 100,
  });
  for (const r of toRemind) {
    if (Date.now() - started > opts.budgetMs) return { ...result, pending: true };
    await db.productStock.update({ where: { productId_key: r }, data: { remindedAt: now } });
    await announceStockAlarms(db, [{ ...r, kind: 'remind' }], now);
    result.reminded++;
  }
  result.cut = [...new Set(result.cut)];
  return result;
}

/** Cierra las tareas de alarma de un producto que ya no hacen falta, por ejemplo al apagar la opción. */
export async function settleStockAlarms(db: Db, productId: string, now = new Date()): Promise<void> {
  const rows = await db.productStock.findMany({ where: { productId }, select: { key: true } });
  await announceStockAlarms(
    db,
    rows.map((r) => ({ productId, key: r.key, kind: 'off' as const })),
    now,
  );
}

export const isStockAlarmTask = (autoKey: string | null) => autoKey?.startsWith(KEY_PREFIX) ?? false;

/** Cuántas medidas de la cuenta se quedaron sin stock con "Mostrar más de 5": el número del menú. */
export function outOfStockCount(db: Db, accountId: string): Promise<number> {
  return db.productStock.count({ where: { outSince: { not: null }, product: { accountId, showMore: true } } });
}

// ───────────────────────────── La pantalla ─────────────────────────────

/** Una publicación y una medida que muestran más stock del que hay, o que se quedaron sin stock. */
export type AlarmRow = {
  publicationId: string;
  title: string;
  externalId: string | null;
  url: string | null;
  storeName: string;
  channelName: string;
  productId: string;
  productName: string;
  // La medida, si el producto tiene varias.
  measure: string | null;
  real: number;
  // Lo que le toca mostrar y lo que tiene ahora el canal.
  shown: number;
  inChannel: number | null;
  level: AlarmLevel;
  outSince: Date | null;
  remindedAt: Date | null;
  cutAt: Date | null;
  // Cuándo sale el aviso del día y cuándo se pausa, si todavía no pasó.
  remindAt: Date | null;
  pauseAt: Date | null;
  taskId: string | null;
};

export type AlarmFilter = 'sin-stock' | 'queda-1' | 'quedan-2' | 'todas';

export const ALARM_FILTERS: { key: AlarmFilter; label: string }[] = [
  { key: 'sin-stock', label: 'Sin stock' },
  { key: 'queda-1', label: 'Queda 1' },
  { key: 'quedan-2', label: 'Quedan 2' },
  { key: 'todas', label: 'Todas' },
];

export const parseAlarmFilter = (raw: unknown): AlarmFilter => (ALARM_FILTERS.some((f) => f.key === raw) ? (raw as AlarmFilter) : 'sin-stock');

export function alarmFilterOf(row: Pick<AlarmRow, 'real'>, filter: AlarmFilter): boolean {
  if (filter === 'sin-stock') return row.real <= 0;
  if (filter === 'queda-1') return row.real === 1;
  if (filter === 'quedan-2') return row.real === 2;
  return true;
}

/**
 * Las publicaciones de la cuenta que muestran más stock del que hay, por
 * medida, y las que se quedaron sin stock aunque ya se hayan pausado. Primero
 * las sin stock que se pausan antes.
 */
export async function loadStockAlarms(db: Db, accountId: string): Promise<AlarmRow[]> {
  const pubs = await db.publication.findMany({
    where: { product: { accountId, showMore: true, kind: 'INDIVIDUAL', stockSince: { not: null } } },
    orderBy: { createdAt: 'asc' },
    select: { ...PLAN_SELECT, url: true },
  });
  if (pubs.length === 0) return [];
  const productIds = [...new Set(pubs.map((p) => p.product.id))];
  const [states, tasks] = await Promise.all([
    db.productStock.findMany({ where: { productId: { in: productIds } }, select: { productId: true, key: true, quantity: true, outSince: true, remindedAt: true, cutAt: true } }),
    db.task.findMany({ where: { accountId, autoKey: { startsWith: KEY_PREFIX }, status: { in: [...OPEN_STATUSES] } }, select: { id: true, autoKey: true } }),
  ]);
  const stateOf = new Map(states.map((r) => [`${r.productId}:${r.key}`, r]));
  const taskOf = new Map(tasks.map((t) => [t.autoKey!, t.id]));

  const rows: AlarmRow[] = [];
  for (const pub of pubs) {
    const plan = planFor(pub);
    if (!plan.managed) continue;
    const source = sourceOf(pub.product);
    const slots = stockSlots(pub.product.variants);
    const copy = pub.channelCopy;
    const variations = parseVariations(copy?.variations);
    // Cada medida que vende la publicación: la línea que le toca y su medida del producto.
    const measures: { v: VariantLike | null; lineKey: string }[] =
      variations.length === 0 ? [{ v: singleMeasure(pub.product, copy, pub.variantKey), lineKey: '' }] : variations.map((v, i) => ({ v, lineKey: quantityKey(v, i) }));
    for (const m of measures) {
      const key = unitParts(source, m.v)?.[0]?.key;
      if (key === undefined) continue;
      const state = stateOf.get(`${pub.product.id}:${key}`);
      const real = state?.quantity ?? 0;
      const shown = plan.lines.find((l) => l.key === m.lineKey)?.quantity ?? 0;
      const out = state?.outSince ?? null;
      if (shown <= Math.max(real, 0) && !out) continue;
      const deadlines = out ? cushionDeadlines(out) : null;
      rows.push({
        publicationId: pub.id,
        title: titleOrUntitled(pub.title),
        externalId: pub.externalId,
        url: pub.url,
        storeName: pub.store.name,
        channelName: getChannelAdapter(pub.store.channel.kind, pub.store.channel.name).name,
        productId: pub.product.id,
        productName: pub.product.name,
        measure: slots.length > 1 ? (slots.find((s) => s.key === key)?.label ?? null) : null,
        real,
        shown,
        inChannel: plan.channel?.find((l) => l.key === m.lineKey)?.quantity ?? null,
        level: alarmLevel(real, { outSince: out, cutAt: state?.cutAt ?? null }),
        outSince: out,
        remindedAt: state?.remindedAt ?? null,
        cutAt: state?.cutAt ?? null,
        remindAt: deadlines && !state?.remindedAt && !state?.cutAt ? deadlines.remindAt : null,
        pauseAt: deadlines && !state?.cutAt && real > -SELL_WITHOUT_STOCK ? deadlines.cutAt : null,
        taskId: taskOf.get(stockAlarmKey(pub.product.id, key)) ?? null,
      });
    }
  }
  const rank = (r: AlarmRow) => (r.real <= 0 ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b) || (a.outSince?.getTime() ?? Infinity) - (b.outSince?.getTime() ?? Infinity) || a.real - b.real || a.productName.localeCompare(b.productName));
}

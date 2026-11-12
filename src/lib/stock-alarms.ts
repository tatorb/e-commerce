import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind, ChannelStatus } from '@/generated/prisma/enums';
import { stockSlots, unitParts } from '@/domain/stock';
import { parseVariations, type VariantLike } from '@/domain/media';
import { quantityKey } from '@/domain/quantities';
import { titleOrUntitled } from '@/domain/publication-title';
import { getChannelAdapter } from '@/channels';
import { PLAN_SELECT, planFor, singleMeasure, sourceOf } from '@/lib/stock-plan';
import { alarmLevel, changeAlarm, owed, owedText, REMIND_AFTER_MS, remindAt, saleAlarm, SHOWN_WHEN_SHORT, type AlarmLevel, type SaleAlarm } from '@/domain/stock-cushion';
import { OPEN_STATUSES, TASK_TITLE_MAX } from '@/domain/tasks';
import { formatDateTime } from '@/lib/format';
import { notifyAssigned, notifyTaskAgain } from '@/lib/task-mail';
import { publicAppUrl } from '@/lib/public-url';
import { textLink } from '@/domain/text-links';
import { stockTaskRecipients } from '@/lib/stock-task-recipients';

// Las alarmas de stock de los productos con "Mostrar más de 5"
// (src/domain/stock-cushion.ts): una tarea por medida, para todos los
// administradores, que se crea con el aviso temprano o al venderse la última,
// cambia con cada venta o ajuste, y se cierra sola al cargar
// stock. Cada aviso sale también por mail. Recibe la base por parámetro para
// poder probarlo.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** La clave de la tarea automática de una medida. */
export const stockAlarmKey = (productId: string, key: string) => `stock:${productId}:${key}`;
const KEY_PREFIX = 'stock:';

/** Un cambio en el stock de una medida: de cuánto a cuánto y por qué. */
export type StockChange = { productId: string; key: string; before: number; after: number; cause: 'sale' | 'cancel' | 'manual' | 'import' };

/** Lo que hay que avisar después de guardar: qué medida y qué pasó. */
// restock: se cargó stock y se regulariza, la tarea se cierra. keep: sigue igual,
// la tarea abierta se actualiza sin avisar.
export type AlarmEvent = { productId: string; key: string; kind: SaleAlarm | 'restock' | 'keep' | 'remind' | 'off' };

/**
 * Dentro de la transacción que cambió el stock: deja anotado el estado de la
 * alarma de cada medida de los productos con la opción, venga de donde venga
 * el cambio. Llegar a 1 anota el aviso temprano; llegar a 0 o menos, desde
 * cuándo falta. Cada venta que la deja en 1, en 0 o sin tener avisa; un
 * ajuste, una carga o una cancelación avisan al entrar en 1 o en 0. Cargar 2
 * o más lo borra. Devuelve lo que hay que avisar.
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
    const row = await tx.productStock.findUnique({ where, select: { outSince: true, lowAt: true } });
    const state = { outSince: row?.outSince ?? null, lowAt: row?.lowAt ?? null };
    // Hay 2 o más: no falta nada.
    if (c.after >= 2) {
      await tx.productStock.update({ where, data: { outSince: null, remindedAt: null, cutAt: null, lowAt: null } });
      events.push({ productId: c.productId, key: c.key, kind: 'restock' });
      continue;
    }
    const alarm = c.cause === 'sale' ? saleAlarm(c.before, c.after) : changeAlarm(c.after, state);
    if (c.after === 1) {
      // Queda 1: el aviso temprano. Si venía sin stock, ya no falta.
      await tx.productStock.update({ where, data: { lowAt: state.lowAt ?? now, outSince: null, remindedAt: null, cutAt: null } });
      // Cargar stock a mano o importarlo, aunque suba solo a 1, regulariza: quien
      // lo carga ya sabe que queda 1, la tarea se cierra. El aviso de "Queda 1"
      // con tarea lo dan una venta, una cancelación o un ajuste que baja a 1.
      const loaded = (c.cause === 'manual' || c.cause === 'import') && c.after > c.before;
      events.push({ productId: c.productId, key: c.key, kind: loaded ? 'restock' : (alarm ?? 'keep') });
      continue;
    }
    // 0 o menos: desde cuándo falta.
    await tx.productStock.update({ where, data: { outSince: state.outSince ?? now, cutAt: null } });
    events.push({ productId: c.productId, key: c.key, kind: alarm ?? 'keep' });
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
      account: { select: { timezone: true, slug: true } },
      variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
    },
  },
} satisfies Prisma.ProductStockSelect;

type StateRow = Prisma.ProductStockGetPayload<{ select: typeof STATE_SELECT }>;

/** El producto, el SKU y la medida de la alarma, para saber qué pedir a fábrica. */
export type AlarmItem = { name: string; sku: string | null; measure: string | null };

export function alarmItem(row: Pick<StateRow, 'key' | 'label'> & { product: { name: string; variants: VariantLike[] } }): AlarmItem {
  const slots = stockSlots(row.product.variants);
  const slot = slots.find((s) => s.key === row.key);
  // Con una sola medida en la ficha, la clave es la vacía: el SKU y la medida son los de esa.
  const only = row.product.variants.length === 1 ? row.product.variants[0] : null;
  return {
    name: row.product.name,
    sku: slot?.sku ?? only?.sku ?? null,
    measure: slots.length > 1 ? (slot?.label ?? (row.label || null)) : (only?.measure ?? null),
  };
}

/** El producto, el SKU y la medida en una línea: "Subconjunto SP-900 · SKU SP-900-50 · medida 0.50". */
export function alarmItemText(item: AlarmItem): string {
  return [item.name, item.sku ? `SKU ${item.sku}` : null, item.measure ? `medida ${item.measure}` : null].filter(Boolean).join(' · ');
}

/** Una publicación que vende la medida: su título, su código y su link en el canal. */
export type AlarmListing = { id: string; title: string; externalId: string | null; channelName: string; url: string | null };

/** El título y la descripción de la tarea según cómo está la medida. */
export function alarmTaskText(
  row: StateRow,
  kind: AlarmEvent['kind'],
  listings: AlarmListing[] = [],
  appUrl: string = publicAppUrl(),
): { title: string; description: string } {
  const tz = row.product.account.timezone;
  const item = alarmItem(row);
  const what = alarmItemText(item);
  // Arriba de todo, lo que hay que pedir a fábrica y dónde se vende, con los
  // links al producto, a cada publicación en la app y en el canal.
  const base = `${appUrl}/a/${row.product.account.slug}`;
  const product = `${base}/productos/${row.product.id}?seccion=stock`;
  const head = [
    `Producto: ${textLink(item.name, product)}`,
    `SKU: ${item.sku ? textLink(item.sku, product) : 'sin cargar en la ficha'}`,
    ...(item.measure ? [`Medida: ${item.measure}`] : []),
    ...listings.map((l) =>
      [
        `Publicación: ${textLink(l.title, `${base}/publicaciones/${l.id}`)}`,
        l.externalId,
        l.url ? textLink(`Ver en ${l.channelName}`, l.url) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  ].join('\n');
  const real = row.quantity;
  const missing = owed(real);
  const stock = `Stock real: ${real}. En los canales se sigue viendo ${SHOWN_WHEN_SHORT}, así que la publicación no se pausa.`;
  const closing = 'Esta tarea se cierra sola al cargar el stock en el producto. Si hay que pausar la publicación, se pausa a mano.';
  const when = (d: Date) => formatDateTime(d, tz);

  if (!row.outSince && real === 1) {
    return {
      title: `Queda 1: ${what}`.slice(0, TASK_TITLE_MAX),
      description: `${head}\n\n${stock} Queda 1 unidad: si se vende, la app avisa de nuevo. ${closing}`,
    };
  }
  const state = missing > 0 ? owedText(missing).toLowerCase() : 'sin stock';
  const parts: string[] = [stock];
  if (row.outSince) parts.push(`Se quedó sin stock el ${when(row.outSince)}.`);
  if (missing > 0) parts.push(`Se ${missing === 1 ? 'vendió 1' : `vendieron ${missing}`} sin tenerla${missing === 1 ? '' : 's'}: hay que comprar${missing === 1 ? 'la' : 'las'} en fábrica para entregar${missing === 1 ? 'la' : 'las'}.`);
  if (kind === 'remind') parts.push('Pasó un día sin reponer.');
  else if (row.outSince) parts.push(`Si no se repone, el ${when(remindAt(row.outSince))} sale otro aviso.`);
  parts.push(closing);
  return { title: `Reponer: ${what}, ${state}`.slice(0, TASK_TITLE_MAX), description: `${head}\n\n${parts.join(' ')}` };
}

/** Las claves de stock de las medidas que vende la publicación. */
function soldKeys(pub: Parameters<typeof planFor>[0]): string[] {
  const source = sourceOf(pub.product);
  const variations = parseVariations(pub.channelCopy?.variations);
  const measures = variations.length === 0 ? [singleMeasure(pub.product, pub.channelCopy, pub.variantKey)] : variations;
  return measures.flatMap((v) => unitParts(source, v)?.[0]?.key ?? []);
}

/**
 * Las publicaciones de la tarea: las del producto que venden esa medida, con
 * su título y su código para la descripción, y después las de sus combos.
 */
async function taskPublications(db: Db, productId: string, key: string): Promise<{ ids: string[]; listings: AlarmListing[] }> {
  const live = { channelStatus: { notIn: ['CLOSED', 'DELETED'] as ('CLOSED' | 'DELETED')[] } };
  const [own, combos] = await Promise.all([
    db.publication.findMany({ where: { productId, ...live }, orderBy: { createdAt: 'asc' }, take: 50, select: { ...PLAN_SELECT, url: true } }),
    db.publication.findMany({ where: { product: { comboItems: { some: { productId } } }, ...live }, orderBy: { createdAt: 'asc' }, take: 20, select: { id: true } }),
  ]);
  const selling = own.filter((p) => soldKeys(p).includes(key));
  return {
    ids: [...selling.map((p) => p.id), ...combos.map((p) => p.id)].slice(0, 20),
    listings: selling.slice(0, 10).map((p) => {
      const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
      return {
        id: p.id,
        title: titleOrUntitled(p.title),
        externalId: p.externalId,
        channelName: adapter.name,
        url: p.url ?? (p.externalId ? adapter.publicationUrl(p.externalId) : null),
      };
    }),
  };
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
  // Se cierra al cargar stock (aunque sea 1) o al apagar la opción sin nada que entregar.
  const pubs = await taskPublications(db, e.productId, e.key);
  const settled = e.kind === 'off' ? row.quantity >= 0 : e.kind === 'restock' && !row.outSince && row.quantity >= 1;
  const notify = e.kind !== 'restock' && e.kind !== 'keep' && e.kind !== 'off';

  const taskId = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${autoKey}))`;
    const open = await tx.task.findFirst({ where: { accountId, autoKey, status: { in: [...OPEN_STATUSES] } }, select: { id: true } });
    if (settled) {
      if (open) await tx.task.update({ where: { id: open.id }, data: { status: 'DONE', doneAt: now } });
      return null;
    }
    const text = alarmTaskText(row, e.kind, pubs.listings);
    const data = {
      title: text.title,
      description: text.description,
      // Sin fecha de pausa: la pausa la decide una persona.
      dueOn: null,
      // El aviso es ya: el mail sale ahora, no en la pasada de cada hora.
      ...(notify ? { remindAt: now, remindedAt: now } : {}),
    };
    if (open) {
      await tx.task.update({ where: { id: open.id }, data });
      return { id: open.id, created: false };
    }
    if (!notify) return null;
    const recipients = await stockTaskRecipients(tx, accountId);
    if (recipients.length === 0) return null;
    const created = await tx.task.create({
      data: {
        accountId,
        ...data,
        autoKey,
        assignees: { create: recipients.map((userId) => ({ userId })) },
        publications: { create: pubs.ids.map((publicationId) => ({ publicationId })) },
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

export type AlarmPassResult = { reminded: number; pending: boolean };

/**
 * En la tarea de cada hora: a las medidas que siguen sin stock, otro aviso al
 * día. Con "Mostrar más de 5" la app nunca pausa la publicación: eso lo
 * decide una persona al ver la alarma.
 */
export async function stockAlarmPass(db: Db, opts: { budgetMs: number; now?: Date }): Promise<AlarmPassResult> {
  const now = opts.now ?? new Date();
  const started = Date.now();
  const result: AlarmPassResult = { reminded: 0, pending: false };
  const toRemind = await db.productStock.findMany({
    where: { product: { showMore: true }, remindedAt: null, outSince: { lte: new Date(now.getTime() - REMIND_AFTER_MS) } },
    select: { productId: true, key: true },
    take: 100,
  });
  for (const r of toRemind) {
    if (Date.now() - started > opts.budgetMs) return { ...result, pending: true };
    await db.productStock.update({ where: { productId_key: r }, data: { remindedAt: now } });
    await announceStockAlarms(db, [{ ...r, kind: 'remind' }], now);
    result.reminded++;
  }
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
  channelKind: ChannelKind;
  // Si está activa, pausada o cerrada en el canal.
  channelStatus: ChannelStatus;
  productId: string;
  productName: string;
  // La medida, si el producto tiene varias, su clave de stock y su SKU en la ficha.
  measure: string | null;
  stockKey: string;
  sku: string | null;
  real: number;
  // Lo que le toca mostrar y lo que tiene ahora el canal.
  shown: number;
  inChannel: number | null;
  level: AlarmLevel;
  outSince: Date | null;
  remindedAt: Date | null;
  // Cuándo sale el aviso del día, si todavía no pasó.
  remindAt: Date | null;
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
 * medida, y las que se quedaron sin stock. Primero las que hace más que
 * faltan.
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
    db.productStock.findMany({ where: { productId: { in: productIds } }, select: { productId: true, key: true, quantity: true, outSince: true, remindedAt: true } }),
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
      rows.push({
        publicationId: pub.id,
        title: titleOrUntitled(pub.title),
        externalId: pub.externalId,
        url: pub.url,
        storeName: pub.store.name,
        channelName: getChannelAdapter(pub.store.channel.kind, pub.store.channel.name).name,
        channelKind: pub.store.channel.kind,
        channelStatus: pub.channelStatus,
        productId: pub.product.id,
        productName: pub.product.name,
        stockKey: key,
        sku: slots.find((s) => s.key === key)?.sku?.trim() || null,
        measure: slots.length > 1 ? (slots.find((s) => s.key === key)?.label ?? null) : null,
        real,
        shown,
        inChannel: plan.channel?.find((l) => l.key === m.lineKey)?.quantity ?? null,
        level: alarmLevel(real, { outSince: out }),
        outSince: out,
        remindedAt: state?.remindedAt ?? null,
        remindAt: out && !state?.remindedAt ? remindAt(out) : null,
        taskId: taskOf.get(stockAlarmKey(pub.product.id, key)) ?? null,
      });
    }
  }
  const rank = (r: AlarmRow) => (r.real <= 0 ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b) || (a.outSince?.getTime() ?? Infinity) - (b.outSince?.getTime() ?? Infinity) || a.real - b.real || a.productName.localeCompare(b.productName));
}

/** Una medida con alarma y las publicaciones que la venden. */
export type AlarmMeasure = Pick<AlarmRow, 'stockKey' | 'measure' | 'sku' | 'real' | 'level' | 'outSince' | 'remindedAt' | 'remindAt' | 'taskId'> & { listings: AlarmRow[] };

/** Un producto con sus medidas con alarma. */
export type AlarmProduct = { productId: string; productName: string; measures: AlarmMeasure[] };

/**
 * Las alarmas agrupadas por producto y, adentro, por medida: cada medida una
 * sola vez, con sus publicaciones abajo. Respeta el orden de las filas: primero
 * el producto de la medida que hace más que falta.
 */
export function groupStockAlarms(rows: AlarmRow[]): AlarmProduct[] {
  const products = new Map<string, AlarmProduct>();
  for (const r of rows) {
    let p = products.get(r.productId);
    if (!p) {
      p = { productId: r.productId, productName: r.productName, measures: [] };
      products.set(r.productId, p);
    }
    let m = p.measures.find((x) => x.stockKey === r.stockKey);
    if (!m) {
      m = {
        stockKey: r.stockKey,
        measure: r.measure,
        sku: r.sku,
        real: r.real,
        level: r.level,
        outSince: r.outSince,
        remindedAt: r.remindedAt,
        remindAt: r.remindAt,
        taskId: r.taskId,
        listings: [],
      };
      p.measures.push(m);
    }
    m.listings.push(r);
  }
  return [...products.values()];
}

// ───────────────────────────── El resumen de pedido ─────────────────────────────

export const ORDER_SUMMARY_TITLE = 'Productos sin stock pero activos en el canal Mercado Libre:';

/** Una línea del resumen de pedido: el SKU de la ficha y el producto, con la medida si tiene varias. */
export type OrderItem = { sku: string | null; name: string };

/**
 * Lo que hay que pedir: cada medida sin stock que tiene al menos una
 * publicación activa en Mercado Libre, una sola vez aunque la vendan varias
 * publicaciones. Las que todavía no se publicaron no cuentan. Ordenadas por
 * SKU; las que no tienen SKU, al final.
 */
export function orderItems(rows: AlarmRow[]): OrderItem[] {
  const items = new Map<string, OrderItem>();
  for (const r of rows) {
    if (r.real > 0 || r.channelKind !== 'MERCADOLIBRE' || r.channelStatus !== 'ACTIVE' || !r.externalId) continue;
    const id = `${r.productId}:${r.stockKey}`;
    if (!items.has(id)) items.set(id, { sku: r.sku, name: r.measure ? `${r.productName} · medida ${r.measure}` : r.productName });
  }
  return [...items.values()].sort(
    (a, b) =>
      Number(a.sku === null) - Number(b.sku === null) ||
      (a.sku ?? '').localeCompare(b.sku ?? '', 'es', { numeric: true }) ||
      a.name.localeCompare(b.name, 'es', { numeric: true }),
  );
}

/** El resumen para copiar y pegar en el pedido. Vacío si no hay nada para pedir. */
export function orderSummaryText(items: OrderItem[]): string {
  if (items.length === 0) return '';
  return [ORDER_SUMMARY_TITLE, '', ...items.map((i) => `* ${i.sku ?? 'sin SKU'} | ${i.name}`)].join('\n');
}

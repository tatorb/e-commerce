import type { InsurLinkStatus, Prisma, PrismaClient } from '@/generated/prisma/client';
import { costOf } from '@/domain/costs';
import {
  appSlots,
  branchTargets,
  catalogKeys,
  checkCost,
  COST_AGAINST_TEXT,
  depositOf,
  depositUnits,
  fichaChanges,
  fichaText,
  insurStock,
  matchArticle,
  normPart,
  precodeMatches,
  slotIndex,
  stockJumps,
  type CostAgainst,
  type FichaChange,
  type InsurFicha,
  type SlotRef,
} from '@/domain/insur';
import { MAX_QUANTITY } from '@/domain/quantities';
import { StockError, stockSlots, type StockSlot } from '@/domain/stock';
import { accountBranches } from '@/lib/branches';
import { CostError, costMap, setProductCosts } from '@/lib/costs';
import { affectedPublications, setProductStock, syncStock } from '@/lib/stock';

// El sistema de Insur. La extensión de Chrome "Insur → E-commerce" lee el
// listado de artículos de Insur con la sesión de la persona y le manda a la
// app los que tienen que ver con sus productos. Acá se cruza cada artículo con
// una medida, se calcula el stock (Insur menos las ventas de los canales desde
// la fecha de corte) y se corrigen el stock y el costo, siempre con las
// funciones de stock y de costos de la app. Los precios de Insur no se guardan
// en ningún registro: el costo va solo al costo del producto. Recibe la base
// por parámetro para poder probarlo.

type Db = PrismaClient;

export class InsurError extends Error {}

/** La cuenta que usa el sistema de Insur. */
export const INSUR_SLUG = 'insur';
/** El 18/11/2026 a las 00:00 de Argentina: el día en que Insur migró de sistema y cargó su saldo inicial. */
export const DEFAULT_CUTOFF = new Date('2026-11-18T03:00:00.000Z');
/** Cuántos artículos acepta la app por pedido. */
export const BATCH_MAX = 300;
const LIST_MAX = 2000;
const UNMATCHED_MAX = 3000;
// Lo que tarda como mucho en subir las cantidades al canal al cerrar; lo demás lo termina la pasada de cada hora.
const SYNC_MS = 20_000;
const NOTE = 'Sistema de Insur';

export const STATUS_LABEL: Record<InsurLinkStatus, string> = {
  AUTO: 'automático',
  CONFIRMED: 'confirmado',
  PENDING: 'por confirmar con la ficha de Insur',
  DOUBTFUL: 'dudoso',
  IGNORED: 'ignorado',
};

/** Los ajustes de la cuenta; la primera vez arrancan con la fecha de corte del 18/11/2026 y en modo prueba. */
export async function insurSettings(db: Db, accountId: string) {
  return db.insurSettings.upsert({ where: { accountId }, create: { accountId, cutoffAt: DEFAULT_CUTOFF }, update: {} });
}

// ───────────────────────────── Los productos de la app ─────────────────────────────

const PRODUCT_SELECT = {
  id: true,
  name: true,
  brand: true,
  partNumber: true,
  stockSince: true,
  replacementCost: true,
  variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
  costs: { select: { key: true, cost: true } },
  stock: { select: { key: true, quantity: true } },
  // Cuántas publicaciones tiene en el canal: entre dos productos con el mismo número de pieza, va el publicado.
  _count: { select: { publications: { where: { externalId: { not: null } } } } },
} as const;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }> & { slots: StockSlot[] };

async function loadProducts(db: Db, accountId: string) {
  // Un combo no tiene stock ni costo propio: sale de sus piezas.
  const rows = await db.product.findMany({ where: { accountId, kind: 'INDIVIDUAL' }, select: PRODUCT_SELECT });
  const products = new Map<string, ProductRow>(rows.map((p) => [p.id, { ...p, slots: stockSlots(p.variants) }]));
  const slots = appSlots([...products.values()].map((p) => ({ id: p.id, partNumber: p.partNumber, slots: p.slots })));
  // Con dos productos con el mismo número de pieza, se cruza con el que está
  // publicado, si es uno solo: el otro suele ser un duplicado sin publicar. Si
  // no se puede elegir, quedan los dos y el artículo sale dudoso.
  const byPart = new Map<string, Set<string>>();
  for (const s of slots) if (s.part) byPart.set(s.part, (byPart.get(s.part) ?? new Set()).add(s.productId));
  const dropped = new Set<string>();
  for (const ids of byPart.values()) {
    if (ids.size < 2) continue;
    const live = [...ids].filter((id) => (products.get(id)?._count.publications ?? 0) > 0);
    if (live.length === 1) for (const id of ids) if (id !== live[0]) dropped.add(id);
  }
  return { products, slots, index: slotIndex(slots.filter((s) => !dropped.has(s.productId))) };
}

const slotKey = (productId: string, key: string) => `${productId}|${key}`;
const slotLabel = (p: ProductRow, key: string) => (p.slots.length > 1 ? (p.slots.find((s) => s.key === key)?.label ?? key) : null);

/** Lo que le pide la extensión a la app antes de leer Insur: con qué cruzar y qué fichas ya tiene. Sin precios. */
export async function insurCatalog(db: Db, accountId: string) {
  const settings = await insurSettings(db, accountId);
  const { products, slots } = await loadProducts(db, accountId);
  const links = await db.insurArticleLink.findMany({
    where: { accountId },
    select: { insurId: true, code: true, status: true, detail: true, bocas: true, data: { select: { readAt: true } } },
  });
  return {
    modo_prueba: settings.approvedAt === null,
    ficha_cada_dias: settings.fichaEveryDays,
    articulos_por_pedido: BATCH_MAX,
    // Los números de pieza y SKU de la app, normalizados: la extensión manda solo los artículos que coinciden.
    claves: catalogKeys(slots),
    marcas: [...new Set([...products.values()].map((p) => (p.brand ?? '').trim().toUpperCase()).filter(Boolean))].sort(),
    productos: [...products.values()].map((p) => ({
      id: p.id,
      numero_de_pieza: p.partNumber,
      medidas: p.slots.map((s) => ({ clave: s.key, medida: s.measure, sku: s.sku })),
    })),
    cruces: links.map((l) => ({
      id: l.insurId,
      codigo: l.code,
      estado: STATUS_LABEL[l.status],
      ignorado: l.status === 'IGNORED',
      detalle: l.detail,
      bocas: l.bocas,
      ficha_leida: l.data?.readAt.toISOString() ?? null,
    })),
  };
}

// ───────────────────────────── Las ventas de los canales ─────────────────────────────

type SoldRow = { sold: number; assigned: Record<string, number>; pending: number };

/**
 * Lo vendido en los canales desde la fecha de corte, por medida, que Insur no
 * registró. Las canceladas y las devueltas no cuentan, ni lo que despacha el
 * canal desde su depósito. De cada medida: cuánto, de qué sucursal salió lo
 * que ya se sabe, y cuánto espera que una persona elija la sucursal.
 */
export async function soldSince(db: Db, accountId: string, cutoff: Date): Promise<{ sales: number; units: number; byKey: Map<string, SoldRow> }> {
  const sales = await db.channelSale.findMany({
    where: { store: { accountId }, orderedAt: { gte: cutoff }, status: { in: ['COUNTED', 'SKIPPED'] } },
    select: { id: true, storeId: true, orderId: true, status: true, lines: true },
  });
  // Una venta que no tocó el stock y después se canceló sigue anotada como salteada: se mira en las ventas.
  const skipped = sales.filter((s) => s.status === 'SKIPPED');
  const cancelled = new Set(
    skipped.length === 0
      ? []
      : (
          await db.sale.findMany({
            where: { storeId: { in: [...new Set(skipped.map((s) => s.storeId))] }, orderId: { in: skipped.map((s) => s.orderId) }, state: 'CANCELLED' },
            select: { storeId: true, orderId: true },
          })
        ).map((s) => `${s.storeId}|${s.orderId}`),
  );
  const byKey = new Map<string, SoldRow>();
  const row = (productId: string, key: string) => {
    const id = slotKey(productId, key);
    const found = byKey.get(id) ?? { sold: 0, assigned: {}, pending: 0 };
    byKey.set(id, found);
    return found;
  };
  let count = 0;
  let units = 0;
  const counted: string[] = [];
  for (const sale of sales) {
    if (cancelled.has(`${sale.storeId}|${sale.orderId}`)) continue;
    let any = false;
    for (const line of Array.isArray(sale.lines) ? sale.lines : []) {
      const parts = line && typeof line === 'object' && !Array.isArray(line) && Array.isArray((line as { parts?: unknown }).parts) ? ((line as { parts: unknown[] }).parts as unknown[]) : [];
      for (const part of parts) {
        const p = part as { productId?: unknown; key?: unknown; quantity?: unknown };
        if (typeof p?.productId !== 'string' || typeof p.key !== 'string' || typeof p.quantity !== 'number' || p.quantity <= 0) continue;
        row(p.productId, p.key).sold += p.quantity;
        units += p.quantity;
        any = true;
      }
    }
    if (any) count++;
    if (any && sale.status === 'COUNTED') counted.push(sale.id);
  }
  if (counted.length > 0) {
    const moves = await db.stockMovement.findMany({
      where: { saleId: { in: counted }, kind: 'SALE' },
      select: { productId: true, key: true, delta: true, branches: true, branchPending: true },
    });
    for (const m of moves) {
      const r = row(m.productId, m.key);
      if (m.branchPending) {
        r.pending -= m.delta;
        continue;
      }
      const b = m.branches && typeof m.branches === 'object' && !Array.isArray(m.branches) ? (m.branches as Record<string, unknown>) : {};
      for (const [id, d] of Object.entries(b)) if (typeof d === 'number' && d < 0) r.assigned[id] = (r.assigned[id] ?? 0) - d;
    }
  }
  return { sales: count, units, byKey };
}

// ───────────────────────────── Lo que manda la extensión ─────────────────────────────

export type InsurArticle = {
  id: number;
  code: string;
  measureName: string | null;
  brand: string | null;
  category: string | null;
  detail: string | null;
  bocas: string | null;
  cordoba: number;
  santaFe: number;
  cost: number | null;
  suspicious: boolean;
  // Cuántas veces el precio del proveedor es el costo, a grandes rasgos: lo calcula la extensión, sin mandar ese precio.
  timesSupplier: string | null;
  ficha: InsurFicha | null;
};

const text = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const cut = (s: string | null, max = 20_000) => (s === null ? null : s.slice(0, max));

// Cuántas veces el precio del proveedor es el costo: solo estos tramos, para que no se pueda deducir el precio.
const TIMES = ['hasta 2', 'entre 2 y 100', 'más de 100'];

/** Los artículos como llegan de la extensión. Lo que no tiene id y código se descarta. */
export function parseArticles(raw: unknown): InsurArticle[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Record<string, unknown>;
    const code = text(o.codigo, 200);
    if (typeof o.id !== 'number' || !Number.isInteger(o.id) || o.id <= 0 || !code) return [];
    const f = o.ficha && typeof o.ficha === 'object' && !Array.isArray(o.ficha) ? (o.ficha as Record<string, unknown>) : null;
    return [
      {
        id: o.id,
        code,
        measureName: text(o.medida, 80),
        brand: text(o.marca, 200),
        category: text(o.rubro, 200),
        detail: text(o.detalle),
        bocas: cut(fichaText(o.bocas), 2000),
        cordoba: depositUnits(o.stock_cordoba),
        santaFe: depositUnits(o.stock_santa_fe),
        cost: typeof o.costo === 'number' && Number.isFinite(o.costo) ? o.costo : null,
        suspicious: o.costo_sospechoso === true,
        timesSupplier: TIMES.includes(String(o.costo_veces_proveedor)) ? String(o.costo_veces_proveedor) : null,
        ficha: f
          ? {
              precode: text(f.precodigo, 200),
              detailGroupId: text(f.detalle_articulo_id, 80),
              detail: cut(fichaText(f.detalle)),
              bocas: cut(fichaText(f.bocas), 2000),
              observations: cut(fichaText(f.observaciones)),
              line: text(f.linea, 200),
              vehicles: cut(fichaText(f.vehiculos)),
              measures: cut(fichaText(f.medidas)),
            }
          : null,
      },
    ];
  });
}

// ───────────────────────────── El resumen de la corrida ─────────────────────────────

export type RunChange = {
  code: string;
  productId: string;
  product: string;
  measure: string | null;
  // El stock total antes y después. Null antes: la app todavía no lo llevaba.
  before: number | null;
  after: number;
  stockChanged: boolean;
  // Cómo queda en cada sucursal, si la cuenta tiene.
  branches?: string;
  // Cambió más de 50 unidades.
  jump: boolean;
  // El costo: igual, cambia, cambia más de 30 %. Sin el monto.
  cost: 'same' | 'changed' | 'big' | null;
};
type Listed = { code: string; product: string | null; measure: string | null; reason: string };
type Unmatched = { code: string; detail: string | null; brand: string | null; category: string | null; measure: string | null; stock: number };

export type RunSummary = {
  changes: RunChange[];
  changesTotal: number;
  jumps: number;
  bigCosts: number;
  // Costos que no se aplicaron.
  suspicious: Listed[];
  // Cruces a los que no se les pudo cargar el stock o el costo.
  skipped: Listed[];
  unmatched: Unmatched[];
  unmatchedTotal: number;
  // Medidas con cruce que no aparecieron en la lectura.
  missing: Listed[];
  // Los productos que cambiaron, para subir sus cantidades al cerrar.
  touched: string[];
  // Fichas que quedaron para la próxima corrida, y los campos que trae la ficha de Insur.
  pendingFichas: number | null;
  fichaFields: string[];
  // Los nombres de los campos que trae el listado de Insur, sin valores.
  listFields: string[];
  // Los costos sospechosos, según cómo quedan contra el costo que ya tiene la app.
  suspiciousAgainst: Record<CostAgainst, number>;
  sales: { sales: number; units: number } | null;
  sync: { sent: number; failed: number; pending: boolean } | null;
};

const emptySummary = (): RunSummary => ({
  changes: [],
  changesTotal: 0,
  jumps: 0,
  bigCosts: 0,
  suspicious: [],
  skipped: [],
  unmatched: [],
  unmatchedTotal: 0,
  missing: [],
  touched: [],
  pendingFichas: null,
  fichaFields: [],
  listFields: [],
  suspiciousAgainst: { near: 0, lower: 0, higher: 0, none: 0 },
  sales: null,
  sync: null,
});

export function parseSummary(raw: unknown): RunSummary {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Partial<RunSummary>) : {};
  return { ...emptySummary(), ...o };
}

const strings = (raw: unknown, max = 50): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 300)).slice(0, max) : []);

/** Empieza una corrida. Con la cuenta en modo prueba, o si se pide, solo muestra. */
export async function openRun(db: Db, args: { accountId: string; userId: string; origin: string; preview: boolean; read: number; now?: Date }) {
  const settings = await insurSettings(db, args.accountId);
  const now = args.now ?? new Date();
  // Una corrida que quedó abierta no terminó.
  await db.insurSyncRun.updateMany({
    where: { accountId: args.accountId, status: 'OPEN' },
    data: { status: 'FAILED', finishedAt: now, errors: ['La corrida no terminó: la extensión dejó de mandar.'] },
  });
  const preview = args.preview || settings.approvedAt === null;
  const sales = await soldSince(db, args.accountId, settings.cutoffAt);
  const run = await db.insurSyncRun.create({
    data: {
      accountId: args.accountId,
      userId: args.userId,
      origin: args.origin === 'diaria' ? 'diaria' : 'boton',
      preview,
      read: Math.max(0, Math.floor(args.read)),
      startedAt: now,
      summary: { ...emptySummary(), sales: { sales: sales.sales, units: sales.units } } as Prisma.InputJsonValue,
    },
    select: { id: true, preview: true },
  });
  return { runId: run.id, preview: run.preview, testMode: settings.approvedAt === null };
}

async function openRunRow(db: Db, accountId: string, runId: string) {
  const run = await db.insurSyncRun.findFirst({ where: { id: runId, accountId } });
  if (!run) throw new InsurError('Esa corrida no existe.');
  if (run.status !== 'OPEN') throw new InsurError('Esa corrida ya se cerró.');
  return run;
}

// ───────────────────────────── Cruzar y corregir ─────────────────────────────

type Decision = { status: InsurLinkStatus; productId: string | null; key: string | null; reason: string | null; candidates: SlotRef[] };

const onlyProduct = (candidates: SlotRef[]) => (new Set(candidates.map((c) => c.productId)).size === 1 ? candidates[0].productId : null);
const doubtful = (reason: string, candidates: SlotRef[]): Decision => ({ status: 'DOUBTFUL', productId: onlyProduct(candidates), key: null, reason, candidates });

/**
 * Recibe una tanda de artículos de una corrida: guarda el cruce de cada uno y
 * los datos de su ficha, y corrige el stock y el costo de los que están
 * cruzados (automático o confirmado). En una corrida de solo mostrar no cambia
 * ni stock ni costo: anota qué haría.
 */
export async function receiveArticles(db: Db, args: { accountId: string; runId: string; userId: string; articles: InsurArticle[]; now?: Date }): Promise<{ received: number; linked: number }> {
  const now = args.now ?? new Date();
  const run = await openRunRow(db, args.accountId, args.runId);
  if (args.articles.length > BATCH_MAX) throw new InsurError(`Como mucho ${BATCH_MAX} artículos por pedido.`);
  const summary = parseSummary(run.summary);
  const settings = await insurSettings(db, args.accountId);
  const { products, index } = await loadProducts(db, args.accountId);
  // Un artículo repetido en la tanda cuenta una vez.
  const articles = [...new Map(args.articles.map((a) => [a.id, a])).values()];
  const existing = new Map(
    (await db.insurArticleLink.findMany({ where: { accountId: args.accountId, insurId: { in: articles.map((a) => a.id) } }, include: { data: true } })).map((l) => [l.insurId, l]),
  );
  // Las medidas que ya tienen su artículo: dos artículos no van a la misma.
  const taken = new Map(
    (await db.insurArticleLink.findMany({ where: { accountId: args.accountId, status: { in: ['AUTO', 'CONFIRMED'] }, productId: { not: null } }, select: { insurId: true, code: true, productId: true, key: true } })).map((l) => [
      slotKey(l.productId!, l.key ?? ''),
      l,
    ]),
  );
  const hasSlot = (productId: string | null, key: string | null) => productId !== null && key !== null && (products.get(productId)?.slots.some((s) => s.key === key) ?? false);

  const decide = (a: InsurArticle): Decision | null => {
    const old = existing.get(a.id) ?? null;
    if (old?.status === 'IGNORED') return { status: 'IGNORED', productId: old.productId, key: old.key, reason: old.reason, candidates: [] };
    const precode = a.ficha?.precode ?? old?.data?.precode ?? null;
    const hasFicha = a.ficha !== null || Boolean(old?.data);
    const match = matchArticle({ code: a.code, measureName: a.measureName }, index);
    const candidates = match.kind === 'auto' ? [{ productId: match.productId, key: match.key }] : match.kind === 'doubtful' ? match.candidates : [];
    if (old && (old.status === 'AUTO' || old.status === 'CONFIRMED')) {
      // Con el cruce hecho no se vuelve a adivinar, salvo que cambie el código o la medida ya no esté.
      if (old.code.trim() !== a.code.trim()) return doubtful(`El código de Insur cambió de "${old.code}" a "${a.code}".`, candidates);
      if (!hasSlot(old.productId, old.key)) return doubtful('La medida con que estaba cruzado ya no está en la ficha del producto.', candidates);
      const part = products.get(old.productId!)!.partNumber;
      if (old.status === 'AUTO' && hasFicha && !precodeMatches(precode, part)) {
        return doubtful(`El precodigo de Insur (${precode ?? 'vacío'}) no coincide con el número de pieza de la ficha (${part ?? 'sin cargar'}).`, [{ productId: old.productId!, key: old.key! }]);
      }
      return { status: old.status, productId: old.productId, key: old.key, reason: null, candidates: [] };
    }
    if (match.kind === 'none') return null;
    if (match.kind === 'doubtful') return doubtful(match.reason, match.candidates);
    const other = taken.get(slotKey(match.productId, match.key));
    if (other && other.insurId !== a.id) return doubtful(`Otro artículo de Insur (${other.code}) ya está cruzado con esa medida.`, candidates);
    // Se confirma con la ficha de Insur: su precodigo tiene que ser el número de pieza.
    if (!hasFicha) return { status: 'PENDING', productId: match.productId, key: match.key, reason: null, candidates };
    const part = products.get(match.productId)!.partNumber;
    if (!precodeMatches(precode, part)) return doubtful(`El precodigo de Insur (${precode ?? 'vacío'}) no coincide con el número de pieza de la ficha (${part ?? 'sin cargar'}).`, candidates);
    return { status: 'AUTO', productId: match.productId, key: match.key, reason: null, candidates: [] };
  };

  type Entry = { article: InsurArticle; key: string };
  const byProduct = new Map<string, Entry[]>();
  let linked = 0;
  for (const a of articles) {
    const d = decide(a);
    const old = existing.get(a.id) ?? null;
    if (!d) {
      // Ya no coincide con nada de la app: el cruce sobra.
      if (old) await db.insurArticleLink.delete({ where: { id: old.id } });
      continue;
    }
    const data = {
      code: a.code,
      measureName: a.measureName,
      brand: a.brand,
      category: a.category,
      detail: a.detail,
      bocas: a.bocas,
      productId: d.productId,
      key: d.key,
      status: d.status,
      reason: d.reason,
      candidates: d.candidates as Prisma.InputJsonValue,
      stockCordoba: a.cordoba,
      stockSantaFe: a.santaFe,
      seenAt: now,
      missingSince: null,
    };
    const link = old ? await db.insurArticleLink.update({ where: { id: old.id }, data, select: { id: true } }) : await db.insurArticleLink.create({ data: { accountId: args.accountId, insurId: a.id, ...data }, select: { id: true } });
    if (a.ficha) {
      const changes = old?.data ? fichaChanges(old.data, a.ficha) : [];
      const changed = changes.length > 0 ? { changes: changes as Prisma.InputJsonValue, changedAt: now } : {};
      await db.insurArticleData.upsert({ where: { linkId: link.id }, create: { linkId: link.id, ...a.ficha, readAt: now }, update: { ...a.ficha, readAt: now, ...changed } });
    }
    if (d.status !== 'AUTO' && d.status !== 'CONFIRMED') continue;
    linked++;
    taken.set(slotKey(d.productId!, d.key!), { insurId: a.id, code: a.code, productId: d.productId, key: d.key });
    byProduct.set(d.productId!, [...(byProduct.get(d.productId!) ?? []), { article: a, key: d.key! }]);
  }

  // ── El stock y el costo de los cruzados.
  const productIds = [...byProduct.keys()];
  const branches = await accountBranches(db, args.accountId);
  const cordoba = branches.find((b) => depositOf(b.name) === 'cordoba') ?? null;
  const santaFe = branches.find((b) => depositOf(b.name) === 'santaFe') ?? null;
  if (branches.length > 0 && (!cordoba || !santaFe)) {
    throw new InsurError(`La cuenta tiene sucursales (${branches.map((b) => b.name).join(', ')}), pero hacen falta una que se llame Córdoba y otra Santa Fe para cargar el stock de cada depósito de Insur.`);
  }
  const depots = cordoba && santaFe ? [cordoba, santaFe] : null;
  const sold = (await soldSince(db, args.accountId, settings.cutoffAt)).byKey;
  const inBranch = new Map<string, number>();
  const waiting = new Map<string, number>();
  if (depots && productIds.length > 0) {
    for (const r of await db.branchStock.findMany({ where: { productId: { in: productIds }, branchId: { in: depots.map((b) => b.id) } }, select: { productId: true, key: true, branchId: true, quantity: true } })) {
      inBranch.set(`${slotKey(r.productId, r.key)}|${r.branchId}`, r.quantity);
    }
    for (const r of await db.stockMovement.groupBy({ by: ['productId', 'key'], where: { productId: { in: productIds }, branchPending: true }, _sum: { delta: true } })) {
      waiting.set(slotKey(r.productId, r.key), -(r._sum.delta ?? 0));
    }
  }

  let stockChanges = 0;
  let costChanges = 0;
  let suspicious = 0;
  const errors = strings(run.errors, 200);
  const touched = new Set(summary.touched);
  const push = <T>(list: T[], item: T, max = LIST_MAX) => {
    if (list.length < max) list.push(item);
  };

  for (const [productId, entries] of byProduct) {
    const p = products.get(productId)!;
    const starting = p.stockSince === null;
    // Un producto que todavía no lleva stock en la app empieza con todas sus medidas, o no empieza.
    const partial = starting && p.slots.some((s) => !entries.some((e) => e.key === s.key));
    const costs = costMap(p.costs);
    const general = p.replacementCost === null ? null : Number(p.replacementCost);
    const stockLoads: Record<string, number>[] = depots ? depots.map(() => ({})) : [{}];
    const costLoads: Record<string, number> = {};
    const rows: RunChange[] = [];
    for (const { article: a, key } of entries) {
      const id = slotKey(productId, key);
      const s = sold.get(id) ?? { sold: 0, assigned: {}, pending: 0 };
      const after = Math.min(MAX_QUANTITY, insurStock({ cordoba: a.cordoba, santaFe: a.santaFe, sold: s.sold }));
      const before = starting ? null : (p.stock.find((x) => x.key === key)?.quantity ?? 0);
      let stockChanged: boolean;
      let branchText: string | undefined;
      if (depots) {
        const assigned = depots.map((b) => s.assigned[b.id] ?? 0);
        const unknown = Math.max(0, s.sold - Object.values(s.assigned).reduce((x, y) => x + y, 0) - s.pending);
        // Entre las sucursales suman el stock más lo vendido que todavía espera sucursal, que la app descuenta aparte.
        const targets = branchTargets([a.cordoba, a.santaFe], assigned, unknown, after + (waiting.get(id) ?? 0)).map((n) => Math.min(MAX_QUANTITY, n));
        const current = depots.map((b) => inBranch.get(`${id}|${b.id}`) ?? 0);
        stockChanged = starting || targets.some((n, i) => n !== current[i]);
        branchText = depots.map((b, i) => `${b.name} ${targets[i]}`).join(' · ');
        targets.forEach((n, i) => {
          if (starting || n !== current[i]) stockLoads[i][key] = n;
        });
      } else {
        stockChanged = before !== after;
        if (stockChanged) stockLoads[0][key] = after;
      }
      if (partial) stockChanged = false;
      const cost = checkCost({ cost: a.cost, suspicious: a.suspicious, current: costOf(costs, general, key) });
      const measure = slotLabel(p, key);
      if (!cost.apply) {
        suspicious++;
        // Sin montos: cómo queda contra el costo de la app y, a grandes rasgos, contra el precio del proveedor.
        const notes = [cost.reason];
        if (cost.against) {
          summary.suspiciousAgainst[cost.against]++;
          notes.push(COST_AGAINST_TEXT[cost.against]);
          if (a.timesSupplier) notes.push(`El costo es ${a.timesSupplier} veces el precio del proveedor.`);
        }
        push(summary.suspicious, { code: a.code, product: p.name, measure, reason: notes.join(' ') });
      } else if (cost.changed) {
        costLoads[key] = cost.cost;
        costChanges++;
        if (cost.big) summary.bigCosts++;
      }
      const jump = stockChanged && stockJumps(before, after);
      if (stockChanged) {
        stockChanges++;
        if (jump) summary.jumps++;
      }
      if (stockChanged || (cost.apply && cost.changed)) {
        summary.changesTotal++;
        rows.push({ code: a.code, productId, product: p.name, measure, before, after, stockChanged, ...(branchText ? { branches: branchText } : {}), jump, cost: cost.apply ? (cost.big ? 'big' : cost.changed ? 'changed' : 'same') : null });
      }
    }
    if (partial) {
      push(summary.skipped, {
        code: entries.map((e) => e.article.code).join(', '),
        product: p.name,
        measure: null,
        reason: 'El producto todavía no lleva stock en la app y no todas sus medidas están cruzadas con Insur: el stock no se cargó.',
      });
    }
    for (const r of rows) push(summary.changes, r);
    if (run.preview) continue;
    try {
      if (!partial) {
        for (const [i, stock] of stockLoads.entries()) {
          if (Object.keys(stock).length === 0) continue;
          await setProductStock(db, { accountId: args.accountId, productId, userId: args.userId, stock, branchId: depots ? depots[i].id : null, sync: false, note: NOTE, now });
          touched.add(productId);
        }
      }
      if (Object.keys(costLoads).length > 0) await setProductCosts(db, { accountId: args.accountId, productId, costs: costLoads, keepMissing: true });
    } catch (e) {
      if (!(e instanceof StockError) && !(e instanceof CostError)) throw e;
      // Solo códigos y el motivo: nunca un monto.
      if (errors.length < 200) errors.push(`${entries.map((x) => x.article.code).join(', ')}: ${e.message}`);
    }
  }

  summary.touched = [...touched];
  await db.insurSyncRun.update({
    where: { id: run.id },
    data: {
      received: { increment: articles.length },
      linked: { increment: linked },
      stockChanges: { increment: stockChanges },
      costChanges: { increment: costChanges },
      suspicious: { increment: suspicious },
      errors,
      summary: summary as Prisma.InputJsonValue,
    },
  });
  return { received: articles.length, linked };
}

/** Los artículos de Insur con stock, de marcas que la app tiene, sin producto en la app: solo para mostrar. */
export async function receiveUnmatched(db: Db, args: { accountId: string; runId: string; total: number; articles: InsurArticle[] }): Promise<void> {
  const run = await openRunRow(db, args.accountId, args.runId);
  const summary = parseSummary(run.summary);
  for (const a of args.articles) {
    if (summary.unmatched.length >= UNMATCHED_MAX) break;
    summary.unmatched.push({ code: a.code, detail: a.detail?.slice(0, 300) ?? null, brand: a.brand, category: a.category, measure: a.measureName && a.measureName !== '-' ? a.measureName : null, stock: a.cordoba + a.santaFe });
  }
  summary.unmatchedTotal = Math.max(summary.unmatched.length, Math.floor(args.total) || 0);
  await db.insurSyncRun.update({ where: { id: run.id }, data: { summary: summary as Prisma.InputJsonValue } });
}

/**
 * Cierra la corrida: lo que tiene cruce y no apareció en la lectura queda en
 * la lista y pasa a dudoso, sin tocar su stock, y las cantidades que cambiaron
 * suben a los canales.
 */
export async function closeRun(
  db: Db,
  args: { accountId: string; runId: string; userId: string; durationMs?: number | null; pendingFichas?: number | null; fichaFields?: unknown; listFields?: unknown; errors?: unknown; now?: Date },
) {
  const now = args.now ?? new Date();
  const run = await openRunRow(db, args.accountId, args.runId);
  const summary = parseSummary(run.summary);
  const gone = await db.insurArticleLink.findMany({
    where: { accountId: args.accountId, status: { not: 'IGNORED' }, OR: [{ seenAt: null }, { seenAt: { lt: run.startedAt } }] },
    select: { id: true, code: true, status: true, productId: true, key: true, product: { select: { name: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } } },
  });
  for (const l of gone) {
    const crossed = l.status === 'AUTO' || l.status === 'CONFIRMED';
    if (crossed) {
      const slots = l.product ? stockSlots(l.product.variants) : [];
      if (summary.missing.length < LIST_MAX) {
        summary.missing.push({ code: l.code, product: l.product?.name ?? null, measure: slots.length > 1 ? (slots.find((s) => s.key === l.key)?.label ?? null) : null, reason: 'No apareció en la lectura de Insur: su stock y su costo no se tocaron.' });
      }
    }
    await db.insurArticleLink.update({
      where: { id: l.id },
      data: {
        missingSince: now,
        ...(crossed
          ? { status: 'DOUBTFUL' as const, reason: 'No apareció en la última lectura de Insur.', candidates: (l.productId && l.key !== null ? [{ productId: l.productId, key: l.key }] : []) as Prisma.InputJsonValue, key: null }
          : {}),
      },
    });
  }
  let sync: RunSummary['sync'] = null;
  if (!run.preview && summary.touched.length > 0) {
    const r = await syncStock(db, { publicationIds: await affectedPublications(db, summary.touched), userId: args.userId, note: 'Por la lectura del sistema de Insur.', budgetMs: SYNC_MS });
    sync = { sent: r.sent, failed: r.failed.length, pending: r.pending };
  }
  summary.sync = sync;
  summary.pendingFichas = typeof args.pendingFichas === 'number' && args.pendingFichas >= 0 ? Math.floor(args.pendingFichas) : null;
  summary.fichaFields = strings(args.fichaFields, 80).map((s) => s.slice(0, 60));
  summary.listFields = strings(args.listFields, 80).map((s) => s.slice(0, 60));
  const errors = [...strings(run.errors, 200), ...strings(args.errors)];
  const done = await db.insurSyncRun.update({
    where: { id: run.id },
    data: {
      status: 'DONE',
      finishedAt: now,
      durationMs: typeof args.durationMs === 'number' && args.durationMs >= 0 ? Math.min(Math.floor(args.durationMs), 24 * 3600_000) : null,
      errors,
      summary: summary as Prisma.InputJsonValue,
    },
  });
  return runView(done);
}

/** Una corrida que la extensión cortó: queda anotada con su motivo. */
export async function failRun(db: Db, args: { accountId: string; userId: string; runId?: string | null; origin: string; error: string; durationMs?: number | null; now?: Date }): Promise<void> {
  const now = args.now ?? new Date();
  const data = {
    status: 'FAILED',
    finishedAt: now,
    durationMs: typeof args.durationMs === 'number' && args.durationMs >= 0 ? Math.floor(args.durationMs) : null,
    errors: [args.error.slice(0, 500)],
  };
  const open = args.runId ? await db.insurSyncRun.findFirst({ where: { id: args.runId, accountId: args.accountId, status: 'OPEN' }, select: { id: true } }) : null;
  if (open) await db.insurSyncRun.update({ where: { id: open.id }, data });
  else await db.insurSyncRun.create({ data: { accountId: args.accountId, userId: args.userId, origin: args.origin === 'diaria' ? 'diaria' : 'boton', preview: true, startedAt: now, ...data } });
}

// ───────────────────────────── Para la pantalla y para Claude ─────────────────────────────

type RunRow = Prisma.InsurSyncRunGetPayload<object>;

function runView(run: RunRow) {
  const summary = parseSummary(run.summary);
  return {
    id: run.id,
    origin: run.origin,
    preview: run.preview,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    read: run.read,
    received: run.received,
    linked: run.linked,
    stockChanges: run.stockChanges,
    costChanges: run.costChanges,
    suspicious: run.suspicious,
    errors: strings(run.errors, 250),
    summary,
  };
}
export type InsurRunView = ReturnType<typeof runView>;

export type DoubtfulLink = {
  id: string;
  insurId: number;
  code: string;
  measureName: string | null;
  detail: string | null;
  brand: string | null;
  reason: string | null;
  stock: number;
  candidates: { productId: string; key: string; product: string; measure: string | null; sku: string | null }[];
};

/** Los cruces dudosos, con las medidas entre las que elegir. */
export async function doubtfulLinks(db: Db, accountId: string, limit = 300): Promise<{ total: number; links: DoubtfulLink[] }> {
  const where = { accountId, status: 'DOUBTFUL' as const };
  const [total, rows] = await Promise.all([
    db.insurArticleLink.count({ where }),
    db.insurArticleLink.findMany({ where, orderBy: [{ code: 'asc' }], take: limit }),
  ]);
  const refsOf = (raw: unknown): SlotRef[] =>
    Array.isArray(raw) ? raw.flatMap((c) => (c && typeof c === 'object' && typeof (c as SlotRef).productId === 'string' && typeof (c as SlotRef).key === 'string' ? [c as SlotRef] : [])) : [];
  const ids = [...new Set(rows.flatMap((r) => refsOf(r.candidates).map((c) => c.productId)))];
  const products = new Map(
    (ids.length ? await db.product.findMany({ where: { id: { in: ids }, accountId }, select: { id: true, name: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } }) : []).map((p) => [
      p.id,
      { name: p.name, slots: stockSlots(p.variants) },
    ]),
  );
  return {
    total,
    links: rows.map((r) => ({
      id: r.id,
      insurId: r.insurId,
      code: r.code,
      measureName: r.measureName && r.measureName !== '-' ? r.measureName : null,
      detail: r.detail,
      brand: r.brand,
      reason: r.reason,
      stock: (r.stockCordoba ?? 0) + (r.stockSantaFe ?? 0),
      candidates: refsOf(r.candidates).flatMap((c) => {
        const p = products.get(c.productId);
        const slot = p?.slots.find((s) => s.key === c.key);
        return p && slot ? [{ productId: c.productId, key: c.key, product: p.name, measure: p.slots.length > 1 ? slot.label : null, sku: slot.sku }] : [];
      }),
    })),
  };
}

/** Lo que muestra la pantalla Sistema de Insur. */
export async function loadInsurScreen(db: Db, accountId: string) {
  const settings = await insurSettings(db, accountId);
  const [last, lastDone, counts, sales, doubt] = await Promise.all([
    db.insurSyncRun.findFirst({ where: { accountId }, orderBy: { startedAt: 'desc' } }),
    db.insurSyncRun.findFirst({ where: { accountId, status: 'DONE' }, orderBy: { startedAt: 'desc' } }),
    db.insurArticleLink.groupBy({ by: ['status'], where: { accountId }, _count: { _all: true } }),
    soldSince(db, accountId, settings.cutoffAt),
    doubtfulLinks(db, accountId),
  ]);
  const count = (s: InsurLinkStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  return {
    settings: { cutoffAt: settings.cutoffAt, approvedAt: settings.approvedAt, fichaEveryDays: settings.fichaEveryDays },
    sales: { sales: sales.sales, units: sales.units },
    links: { auto: count('AUTO'), confirmed: count('CONFIRMED'), pending: count('PENDING'), doubtful: count('DOUBTFUL'), ignored: count('IGNORED') },
    last: last ? runView(last) : null,
    lastDone: lastDone && lastDone.id !== last?.id ? runView(lastDone) : null,
    doubtful: doubt,
  };
}

/** Aprueba la primera corrida: desde acá las corridas corrigen solas. */
export async function approveInsur(db: Db, args: { accountId: string; userId: string; now?: Date }): Promise<void> {
  await insurSettings(db, args.accountId);
  await db.insurSettings.update({ where: { accountId: args.accountId }, data: { approvedAt: args.now ?? new Date(), approvedById: args.userId } });
}

/** Cambia la fecha de corte y cada cuántos días se vuelve a leer cada ficha. */
export async function saveInsurSettings(db: Db, args: { accountId: string; cutoffAt?: Date; fichaEveryDays?: number }): Promise<void> {
  await insurSettings(db, args.accountId);
  if (args.cutoffAt && Number.isNaN(args.cutoffAt.getTime())) throw new InsurError('La fecha de corte no vale.');
  if (args.fichaEveryDays !== undefined && (!Number.isInteger(args.fichaEveryDays) || args.fichaEveryDays < 1 || args.fichaEveryDays > 90)) {
    throw new InsurError('Cada cuántos días se lee la ficha: un número de 1 a 90.');
  }
  await db.insurSettings.update({
    where: { accountId: args.accountId },
    data: { ...(args.cutoffAt ? { cutoffAt: args.cutoffAt } : {}), ...(args.fichaEveryDays !== undefined ? { fichaEveryDays: args.fichaEveryDays } : {}) },
  });
}

export type LinkChoice = { ignore: true } | { ignore?: false; productId: string; key: string };

/**
 * Confirma a qué medida va un artículo de Insur, o lo ignora. link: el id del
 * cruce, o el id o el código del artículo en Insur. Con preview solo dice qué
 * haría. El stock y el costo se corrigen en la corrida siguiente.
 */
export async function setInsurLink(db: Db, args: { accountId: string; link: string; choice: LinkChoice; userId: string; preview?: boolean; now?: Date }) {
  const ref = args.link.trim();
  const found = await db.insurArticleLink.findMany({
    where: { accountId: args.accountId, OR: [{ id: ref }, ...(/^\d+$/.test(ref) ? [{ insurId: Number(ref) }] : []), { code: { equals: ref, mode: 'insensitive' as const } }] },
    take: 3,
  });
  const link = found.find((l) => l.id === ref) ?? (found.length === 1 ? found[0] : null);
  if (!link) throw new InsurError(found.length > 1 ? `Hay más de un artículo de Insur con "${ref}": pasá el id.` : `No hay un artículo de Insur "${ref}" entre los cruces.`);
  if (args.choice.ignore) {
    if (!args.preview) {
      await db.insurArticleLink.update({ where: { id: link.id }, data: { status: 'IGNORED', key: null, productId: null, reason: null, decidedById: args.userId, decidedAt: args.now ?? new Date() } });
    }
    return { code: link.code, insurId: link.insurId, status: 'IGNORED' as const, product: null, measure: null, before: link.status };
  }
  const { productId, key } = args.choice;
  const product = await db.product.findFirst({ where: { id: productId, accountId: args.accountId }, select: { name: true, kind: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } });
  if (!product) throw new InsurError('El producto no está en la cuenta.');
  if (product.kind === 'COMBO') throw new InsurError('Es un combo: su stock y su costo salen de sus piezas.');
  const slots = stockSlots(product.variants);
  const slot = slots.find((s) => s.key === key);
  if (!slot) throw new InsurError(`Esa medida no está en la ficha del producto. Medidas: ${slots.map((s) => s.label || 'sin medida').join(', ')}.`);
  const other = await db.insurArticleLink.findFirst({ where: { accountId: args.accountId, productId, key, status: { in: ['AUTO', 'CONFIRMED'] }, id: { not: link.id } }, select: { code: true } });
  if (other) throw new InsurError(`Esa medida ya está cruzada con el artículo ${other.code} de Insur. Primero ignorá o cambiá ese.`);
  if (!args.preview) {
    await db.insurArticleLink.update({
      where: { id: link.id },
      data: { status: 'CONFIRMED', productId, key, reason: null, candidates: [], decidedById: args.userId, decidedAt: args.now ?? new Date() },
    });
  }
  return { code: link.code, insurId: link.insurId, status: 'CONFIRMED' as const, product: product.name, measure: slots.length > 1 ? slot.label : null, before: link.status };
}

// ───────────────────────────── Los datos de Insur de un producto ─────────────────────────────

const FIELD_LABEL: Record<FichaChange['field'], string> = { detail: 'el detalle', observations: 'las observaciones', vehicles: 'los vehículos' };

export type InsurProductRow = {
  linkId: string;
  code: string;
  status: InsurLinkStatus;
  statusLabel: string;
  // La medida de la app; null si el producto no tiene medidas o el artículo no está cruzado.
  measure: string | null;
  crossed: boolean;
  stockCordoba: number | null;
  stockSantaFe: number | null;
  reason: string | null;
  ficha: (InsurFicha & { readAt: Date; changes: FichaChange[]; changedAt: Date | null }) | null;
};

/**
 * Los datos de Insur de un producto, una fila por artículo, con sus avisos.
 * Solo referencia: no se copian a la ficha ni van al canal. Sin precios. Null
 * si la cuenta no usa el sistema de Insur.
 */
export async function insurProductData(db: Db, args: { accountId: string; productId: string }): Promise<{ rows: InsurProductRow[]; warnings: string[] } | null> {
  if (!(await db.insurSettings.findUnique({ where: { accountId: args.accountId }, select: { accountId: true } }))) return null;
  const product = await db.product.findFirst({
    where: { id: args.productId, accountId: args.accountId },
    select: { kind: true, partNumber: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } },
  });
  if (!product || product.kind === 'COMBO') return null;
  const slots = stockSlots(product.variants);
  const links = await db.insurArticleLink.findMany({ where: { accountId: args.accountId, productId: args.productId, status: { not: 'IGNORED' } }, include: { data: true }, orderBy: { code: 'asc' } });
  const parseChanges = (raw: unknown): FichaChange[] =>
    Array.isArray(raw) ? raw.filter((c): c is FichaChange => Boolean(c) && typeof c === 'object' && ['detail', 'observations', 'vehicles'].includes((c as FichaChange).field)) : [];
  const order = (l: (typeof links)[number]) => (l.key === null ? slots.length : slots.findIndex((s) => s.key === l.key));
  const rows: InsurProductRow[] = [...links]
    .sort((a, b) => order(a) - order(b))
    .map((l) => {
      const crossed = l.status === 'AUTO' || l.status === 'CONFIRMED' || l.status === 'PENDING';
      const slot = l.key !== null ? slots.find((s) => s.key === l.key) : undefined;
      return {
        linkId: l.id,
        code: l.code,
        status: l.status,
        statusLabel: STATUS_LABEL[l.status],
        measure: slot && slots.length > 1 ? slot.label : null,
        crossed,
        stockCordoba: l.stockCordoba,
        stockSantaFe: l.stockSantaFe,
        reason: l.reason,
        ficha: l.data
          ? {
              precode: l.data.precode,
              detailGroupId: l.data.detailGroupId,
              detail: l.data.detail,
              bocas: l.data.bocas,
              observations: l.data.observations,
              line: l.data.line,
              vehicles: l.data.vehicles,
              measures: l.data.measures,
              readAt: l.data.readAt,
              changes: parseChanges(l.data.changes),
              changedAt: l.data.changedAt,
            }
          : null,
      };
    });
  const warnings: string[] = [];
  const precodes = [...new Set(rows.flatMap((r) => (r.ficha?.precode ? [r.ficha.precode] : [])))];
  for (const precode of precodes) {
    if (!precodeMatches(precode, product.partNumber)) warnings.push(`El número de pieza de la ficha (${product.partNumber ?? 'sin cargar'}) no coincide con el precodigo de Insur (${precode}).`);
  }
  const crossedKeys = new Set(links.filter((l) => l.status !== 'DOUBTFUL' && l.key !== null).map((l) => l.key));
  if (links.length === 0) warnings.push('Este producto no tiene ningún artículo de Insur cruzado.');
  else for (const s of slots) if (!crossedKeys.has(s.key)) warnings.push(`${slots.length > 1 ? `La medida ${s.label}` : 'El producto'} no tiene un artículo de Insur cruzado.`);
  const groups = [...new Set(rows.flatMap((r) => (r.crossed && r.ficha?.detailGroupId ? [r.ficha.detailGroupId] : [])))];
  if (groups.length > 1) warnings.push(`Las medidas están repartidas en ${groups.length} fichas distintas de Insur (detalleArticuloId ${groups.join(', ')}).`);
  for (const r of rows) {
    if (r.status === 'DOUBTFUL') warnings.push(`Insur tiene el artículo ${r.code} y no está cruzado con ninguna medida de la app${r.reason ? `: ${r.reason}` : '.'}`);
    for (const c of r.ficha?.changes ?? []) {
      warnings.push(`En ${r.code} cambió ${FIELD_LABEL[c.field]} desde la lectura anterior. Antes: "${c.before ?? 'vacío'}". Ahora: "${c.after ?? 'vacío'}".`);
    }
  }
  return { rows, warnings };
}

/** Un producto de la cuenta por su id, su número de pieza o el SKU de una medida, y la medida pedida. Para set_insur_link. */
export async function findSlot(db: Db, args: { accountId: string; product: string; measure?: string | null }): Promise<{ productId: string; key: string }> {
  const { products } = await loadProducts(db, args.accountId);
  const code = normPart(args.product);
  const byId = products.get(args.product.trim());
  const byPart = [...products.values()].filter((p) => normPart(p.partNumber) === code && code !== '');
  const bySku = [...products.values()].flatMap((p) => p.slots.filter((s) => normPart(s.sku) === code && code !== '').map((s) => ({ p, key: s.key })));
  const p = byId ?? (byPart.length === 1 ? byPart[0] : null) ?? (byPart.length === 0 && bySku.length === 1 ? bySku[0].p : null);
  if (!p) throw new InsurError(byPart.length > 1 || bySku.length > 1 ? `Hay más de un producto con "${args.product}": pasá el id del producto.` : `No hay un producto con el número de pieza o el SKU "${args.product}".`);
  if (p.slots.length === 1) return { productId: p.id, key: p.slots[0].key };
  const wanted = (args.measure ?? '').trim();
  const plain = (s: string | null | undefined) => (s ?? '').trim().toUpperCase().replace(',', '.');
  const slot = wanted ? p.slots.find((s) => s.key === wanted || plain(s.label) === plain(wanted) || plain(s.measure) === plain(wanted) || normPart(s.sku) === normPart(wanted)) : !byId && byPart.length === 0 ? p.slots.find((s) => s.key === bySku[0].key) : undefined;
  if (!slot) throw new InsurError(`${wanted ? `"${wanted}" no es una medida del producto.` : 'El producto tiene medidas: falta la medida.'} Medidas: ${p.slots.map((s) => s.label).join(', ')}.`);
  return { productId: p.id, key: slot.key };
}

import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelFlex } from '@/channels/flex';
import { flexWanted, type BranchStockMap } from '@/domain/branches';
import { parseVariantListings, parseVariations, type VariantLike } from '@/domain/media';
import { isManaged } from '@/domain/stock';
import { applyFlex } from '@/lib/flex';
import { singleMeasure, SOURCE_SELECT, sourceOf } from '@/lib/stock-plan';
import { BRANCH_SELECT } from '@/lib/branches';

// Envíos Flex según el stock de las sucursales: en una cuenta con sucursales
// con Flex, cada publicación ofrece Flex solo si una de esas sucursales tiene
// para vender lo que vende. La app lo prende y lo apaga sola en el canal,
// después de cada cambio de stock y en la pasada de cada hora, y lo deja en el
// registro. Una publicación en que una persona cambió Flex a mano deja de
// seguirlo hasta que se lo vuelve a prender. Recibe la base por parámetro
// para poder probarlo.

type Db = PrismaClient;

// Sin tomar nada de flex.ts al cargar: flex.ts termina importando este módulo.
const SELECT = {
  id: true,
  title: true,
  externalId: true,
  variantListings: true,
  variantKey: true,
  flexFollowsStock: true,
  unitsPerSale: true,
  store: { select: { id: true, accountId: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } },
  channelCopy: { select: { flex: true, status: true, missingSince: true, stockInChannel: true, variations: true, details: true } },
  product: { select: SOURCE_SELECT },
} as const;

// Un intento que no salió no se repite igual antes de este tiempo.
const RETRY_MS = 24 * 3600_000;

export type FlexPlan =
  // Sigue al stock: si tiene que estar prendido y por qué.
  | { follows: true; on: boolean; reason: string; current: boolean | null }
  // No lo sigue: por qué.
  | { follows: false; reason: string; current: boolean | null };

type Row = Awaited<ReturnType<typeof loadRows>>[number];

async function loadRows(db: Db, publicationIds: string[]) {
  return db.publication.findMany({ where: { id: { in: [...new Set(publicationIds)] } }, select: SELECT });
}

/** Las medidas que vende la publicación: las del canal, las de su familia o la que vende sola. */
function soldMeasures(p: Row): (VariantLike | null)[] {
  const variations = parseVariations(p.channelCopy?.variations);
  if (variations.length > 0) return variations;
  const family = parseVariantListings(p.variantListings);
  if (family.length >= 2) return family;
  return [singleMeasure(p.product, p.channelCopy, p.variantKey)];
}

/** Lo que tiene que pasar con Flex en esas publicaciones, por su id. Solo las de cuentas con sucursales. */
export async function flexPlans(db: Db, publicationIds: string[]): Promise<Map<string, FlexPlan>> {
  const out = new Map<string, FlexPlan>();
  if (publicationIds.length === 0) return out;
  const rows = await loadRows(db, publicationIds);
  const accountIds = [...new Set(rows.map((r) => r.store.accountId))];
  const branches = await db.branch.findMany({ where: { accountId: { in: accountIds } }, select: { ...BRANCH_SELECT, accountId: true } });
  const withBranches = new Set(branches.map((b) => b.accountId));
  const flexBranches = branches.filter((b) => b.flex);
  const productIds = [...new Set(rows.flatMap((r) => [r.product.id, ...r.product.comboItems.map((i) => i.product.id)]))];
  const stockRows = flexBranches.length
    ? await db.branchStock.findMany({ where: { productId: { in: productIds }, branchId: { in: flexBranches.map((b) => b.id) } }, select: { productId: true, key: true, branchId: true, quantity: true } })
    : [];
  const stockOf = (branchId: string): BranchStockMap => {
    const map: BranchStockMap = new Map();
    for (const r of stockRows) if (r.branchId === branchId) map.set(r.productId, { ...(map.get(r.productId) ?? {}), [r.key]: r.quantity });
    return map;
  };
  for (const p of rows) {
    if (!withBranches.has(p.store.accountId)) continue;
    const current = p.channelCopy?.flex ?? null;
    const no = (reason: string) => out.set(p.id, { follows: false, reason, current });
    if (!flexBranches.some((b) => b.accountId === p.store.accountId)) {
      no('Ninguna sucursal tiene Flex: Flex se cambia a mano.');
      continue;
    }
    if (!p.flexFollowsStock) {
      no('Flex se cambió a mano en esta publicación: no sigue al stock de las sucursales.');
      continue;
    }
    if (!getChannelFlex(p.store.channel.kind)) {
      no(`${p.store.channel.name} no tiene Envíos Flex.`);
      continue;
    }
    if (!p.externalId || !p.channelCopy || p.channelCopy.missingSince) {
      no(`Todavía no se leyó de ${p.store.channel.name}.`);
      continue;
    }
    if (p.channelCopy.stockInChannel) {
      no(`El stock lo maneja ${p.store.channel.name}, por ejemplo en Full: no lleva Flex.`);
      continue;
    }
    if (!['ACTIVE', 'PAUSED'].includes(p.channelCopy.status)) {
      no('No está activa ni pausada en el canal.');
      continue;
    }
    const source = sourceOf(p.product, p.unitsPerSale);
    if (!isManaged(source)) {
      no('El producto todavía no tiene stock en la app.');
      continue;
    }
    const own = flexBranches.filter((b) => b.accountId === p.store.accountId);
    const wanted = flexWanted(
      source,
      soldMeasures(p),
      own.map((b) => ({ branch: b, stock: stockOf(b.id) })),
    );
    if (!wanted) {
      no('No se sabe qué medida del producto vende.');
      continue;
    }
    out.set(p.id, { follows: true, on: wanted.on, reason: wanted.reason, current });
  }
  return out;
}

/** Si el último intento que no salió fue este mismo, hace poco. */
async function failedLately(db: Db, publicationId: string, on: boolean, now: Date): Promise<boolean> {
  const last = await db.channelSyncChange.findFirst({ where: { publicationId, field: 'flex' }, orderBy: { createdAt: 'desc' }, select: { kind: true, after: true, createdAt: true } });
  return last?.kind === 'STATUS_FAILED' && last.after === on && now.getTime() - last.createdAt.getTime() < RETRY_MS;
}

export type FlexSyncResult = { changed: { publicationId: string; on: boolean }[]; failed: { publicationId: string; message: string }[]; pending: boolean };

/**
 * Prende o apaga Flex en el canal en las publicaciones que lo tienen distinto
 * de lo que les toca por el stock de las sucursales con Flex.
 */
export async function syncFlex(db: Db, args: { publicationIds: string[]; userId?: string | null; budgetMs?: number; now?: Date }): Promise<FlexSyncResult> {
  const started = Date.now();
  const now = args.now ?? new Date();
  const result: FlexSyncResult = { changed: [], failed: [], pending: false };
  const plans = await flexPlans(db, args.publicationIds);
  const todo = [...plans].filter(([, plan]) => plan.follows && plan.on !== plan.current) as [string, Extract<FlexPlan, { follows: true }>][];
  if (todo.length === 0) return result;
  const rows = new Map((await loadRows(db, todo.map(([id]) => id))).map((r) => [r.id, r]));
  for (const [id, plan] of todo) {
    if (args.budgetMs !== undefined && Date.now() - started > args.budgetMs) {
      result.pending = true;
      break;
    }
    if (await failedLately(db, id, plan.on, now)) continue;
    const row = rows.get(id);
    if (!row) continue;
    const r = await applyFlex(db, row, plan.on, { userId: args.userId ?? null, note: `Por el stock de las sucursales: ${plan.reason}` });
    if (r.ok) result.changed.push({ publicationId: id, on: plan.on });
    else result.failed.push({ publicationId: id, message: r.message });
  }
  return result;
}

/** En la pasada de cada hora: todas las publicaciones de las cuentas con sucursales con Flex. */
export async function reconcileFlex(db: Db, opts: { budgetMs: number }): Promise<FlexSyncResult> {
  const rows = await db.publication.findMany({
    where: { externalId: { not: null }, flexFollowsStock: true, store: { account: { branches: { some: { flex: true } } } }, channelCopy: { is: { missingSince: null, stockInChannel: false } } },
    select: { id: true },
  });
  return syncFlex(db, { publicationIds: rows.map((r) => r.id), budgetMs: opts.budgetMs });
}

/** Vuelve a seguir el stock en esas publicaciones (o deja de seguirlo) y aplica lo que les toca. */
export async function setFlexFollowsStock(db: Db, args: { accountId: string; publicationIds: string[]; on: boolean; userId: string | null }): Promise<FlexSyncResult> {
  await db.publication.updateMany({ where: { id: { in: args.publicationIds }, product: { accountId: args.accountId } }, data: { flexFollowsStock: args.on } });
  if (!args.on) return { changed: [], failed: [], pending: false };
  return syncFlex(db, { publicationIds: args.publicationIds, userId: args.userId });
}

/**
 * Después de prender o apagar el Flex de una sucursal: cada publicación que
 * sigue al stock queda como le toca. Si ya ninguna sucursal tiene Flex, se
 * apaga en todas las que lo tenían.
 */
export async function afterBranchFlex(db: Db, args: { accountId: string; userId: string | null; budgetMs: number }): Promise<FlexSyncResult> {
  const ids = (await db.publication.findMany({ where: { product: { accountId: args.accountId }, externalId: { not: null } }, select: { id: true } })).map((p) => p.id);
  if ((await db.branch.count({ where: { accountId: args.accountId, flex: true } })) > 0) return syncFlex(db, { publicationIds: ids, userId: args.userId, budgetMs: args.budgetMs });
  const started = Date.now();
  const result: FlexSyncResult = { changed: [], failed: [], pending: false };
  const rows = await db.publication.findMany({
    where: { id: { in: ids }, flexFollowsStock: true, channelCopy: { is: { flex: true, missingSince: null } } },
    select: SELECT,
  });
  for (const row of rows) {
    if (Date.now() - started > args.budgetMs) {
      result.pending = true;
      break;
    }
    const r = await applyFlex(db, row, false, { userId: args.userId, note: 'Se apagó Flex en todas las sucursales.' });
    if (r.ok) result.changed.push({ publicationId: row.id, on: false });
    else result.failed.push({ publicationId: row.id, message: r.message });
  }
  return result;
}

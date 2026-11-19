import { loadSavedCategories } from '@/lib/catalog-categories';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter, type ChannelAdapter } from '@/channels';

// La categoría que tiene cada publicación en el canal, aparte de la de la app.
// El canal puede cambiarla por su cuenta (Mercado Libre: "Elegimos por vos una
// nueva categoría") y finaliza las opciones de venta que quedan en la vieja,
// mezcladas con las nuevas dentro del mismo producto. Por eso cada producto va
// en la categoría que el canal ya eligió para él, con todas sus opciones y
// medidas en esa misma.

type Db = PrismaClient | Prisma.TransactionClient;

export type ChannelCategoryGroup = { categoryId: string; name: string; externalIds: string[] };

/** El nombre de la categoría: el de la app si la conoce, el que leyó del canal o su código. */
export function categoryLabel(adapter: ChannelAdapter, id: string, details?: unknown): string {
  const known = adapter.catalog?.category(id)?.name;
  if (known) return known;
  const read = details && typeof details === 'object' && !Array.isArray(details) ? (details as { categoryName?: unknown }).categoryName : null;
  return typeof read === 'string' && read.trim() ? read.trim() : id;
}

export const categoryText = (g: { categoryId: string; name: string }) => (g.name === g.categoryId ? g.categoryId : `${g.name} (${g.categoryId})`);

/** Las publicaciones vivas en el canal: activas, sin frenar y leídas. */
const LIVE = { status: 'ACTIVE' as const, missingSince: null, statusBlocked: false };

/**
 * En qué categorías tiene el canal las publicaciones activas del producto en
 * la tienda (todas sus medidas y opciones de venta), de la más usada a la menos.
 */
export async function productChannelCategories(db: Db, args: { productId: string; storeId: string; exceptIds?: string[] }): Promise<ChannelCategoryGroup[]> {
  const rows = await db.publication.findMany({
    where: {
      productId: args.productId,
      storeId: args.storeId,
      externalId: { not: null },
      ...(args.exceptIds?.length ? { id: { notIn: args.exceptIds } } : {}),
      channelCopy: { ...LIVE, categoryId: { not: null } },
    },
    orderBy: { externalId: 'asc' },
    select: { externalId: true, store: { select: { channel: { select: { kind: true, name: true } } } }, channelCopy: { select: { categoryId: true, details: true } } },
  });
  const groups = new Map<string, ChannelCategoryGroup>();
  for (const r of rows) {
    const id = r.channelCopy!.categoryId!;
    const adapter = getChannelAdapter(r.store.channel.kind, r.store.channel.name);
    const g = groups.get(id) ?? { categoryId: id, name: categoryLabel(adapter, id, r.channelCopy!.details), externalIds: [] };
    g.externalIds.push(r.externalId!);
    groups.set(id, g);
  }
  return [...groups.values()].sort((a, b) => b.externalIds.length - a.externalIds.length);
}

/** El aviso cuando el producto tiene opciones activas en categorías distintas. */
export function clashText(groups: ChannelCategoryGroup[], channelName: string): string {
  return `En ${channelName} el producto tiene opciones activas en categorías distintas: ${groups
    .map((g) => `${categoryText(g)} en ${g.externalIds.join(', ')}`)
    .join('; ')}. ${channelName} finaliza las que quedan en otra categoría: dejalas todas en la misma antes de crear otra.`;
}

/**
 * Después de leer una publicación: si el canal le cambió la categoría desde la
 * lectura anterior (la app nunca la cambia en una publicación que ya existe),
 * la app toma esa categoría en la publicación, su opción principal, todas sus
 * opciones de venta y las medidas de su familia, y lo deja en el registro.
 * Si la app no conoce esa categoría, solo lo anota.
 */
export async function adoptChannelCategory(
  tx: Prisma.TransactionClient,
  args: { publicationId: string; before: string | null; after: string | null; adapter: ChannelAdapter; details: unknown; syncId: string | null },
): Promise<string[]> {
  const { before, after, adapter } = args;
  if (!before || !after || before === after) return [];
  await loadSavedCategories(tx, adapter.kind);
  const name = categoryLabel(adapter, after, args.details);
  const was = categoryLabel(adapter, before);
  const known = Boolean(adapter.catalog?.category(after));
  const p = await tx.publication.findUniqueOrThrow({ where: { id: args.publicationId }, select: { id: true, mainOptionId: true, familyId: true } });
  const main = p.mainOptionId ?? p.id;
  const mainRow = main === p.id ? p : await tx.publication.findUnique({ where: { id: main }, select: { id: true, mainOptionId: true, familyId: true } });
  const familyId = mainRow?.familyId ?? p.familyId;
  const heads = familyId ? (await tx.publication.findMany({ where: { familyId }, select: { id: true } })).map((m) => m.id) : [main];
  const ids = known
    ? [...new Set([p.id, main, ...heads, ...(await tx.publication.findMany({ where: { mainOptionId: { in: heads } }, select: { id: true } })).map((o) => o.id)])]
    : [];
  if (ids.length > 0) await tx.publication.updateMany({ where: { id: { in: ids } }, data: { channelCategory: after } });
  await tx.channelSyncChange.create({
    data: {
      syncId: args.syncId,
      publicationId: p.id,
      field: 'category',
      kind: 'TAKEN',
      before: was,
      after: name,
      message: known
        ? `${adapter.name} cambió la categoría a ${name} (${after}): la app la tomó en ${ids.length === 1 ? 'esta publicación' : `${ids.length} publicaciones de la familia y sus opciones de venta`}.`
        : `${adapter.name} cambió la categoría a ${name} (${after}), que la app todavía no tiene en sus datos de catálogo: queda la de la app.`,
    },
  });
  return ids;
}

export type CategoryClash = {
  productId: string;
  product: string;
  store: string;
  channelName: string;
  groups: ChannelCategoryGroup[];
};

/**
 * Los productos de la cuenta con opciones de venta activas en categorías
 * distintas en el canal, para dejarlas todas en la misma antes de que el
 * canal finalice las de la otra.
 */
export async function listCategoryClashes(db: Db, accountId: string): Promise<CategoryClash[]> {
  const rows = await db.publication.findMany({
    where: { product: { accountId }, externalId: { not: null }, channelCopy: { ...LIVE, categoryId: { not: null } } },
    select: {
      externalId: true,
      productId: true,
      storeId: true,
      product: { select: { name: true } },
      store: { select: { name: true, channel: { select: { kind: true, name: true } } } },
      channelCopy: { select: { categoryId: true, details: true } },
    },
    orderBy: { externalId: 'asc' },
  });
  const byProduct = new Map<string, typeof rows>();
  for (const r of rows) byProduct.set(`${r.storeId}|${r.productId}`, [...(byProduct.get(`${r.storeId}|${r.productId}`) ?? []), r]);
  const out: CategoryClash[] = [];
  for (const list of byProduct.values()) {
    const ids = new Set(list.map((r) => r.channelCopy!.categoryId!));
    if (ids.size < 2) continue;
    const first = list[0];
    const adapter = getChannelAdapter(first.store.channel.kind, first.store.channel.name);
    const groups = [...ids]
      .map((id) => ({
        categoryId: id,
        name: categoryLabel(adapter, id, list.find((r) => r.channelCopy!.categoryId === id)!.channelCopy!.details),
        externalIds: list.filter((r) => r.channelCopy!.categoryId === id).map((r) => r.externalId!),
      }))
      .sort((a, b) => b.externalIds.length - a.externalIds.length);
    out.push({ productId: first.productId, product: first.product.name, store: first.store.name, channelName: adapter.name, groups });
  }
  return out.sort((a, b) => a.product.localeCompare(b.product));
}

// Una categoría que cambió el canal se avisa estos días.
const ALERT_DAYS = 30;

export type CategoryAlert = { text: string; changedAt: Date | null; split: boolean };

/**
 * Las alertas de categoría de esas publicaciones, por su id: el canal le
 * cambió la categoría por su cuenta a alguna publicación del producto en los
 * últimos días, o el producto quedó con opciones activas en dos categorías.
 */
export async function categoryAlerts(db: Db, publicationIds: string[], now = new Date()): Promise<Map<string, CategoryAlert>> {
  const out = new Map<string, CategoryAlert>();
  if (publicationIds.length === 0) return out;
  const pubs = await db.publication.findMany({ where: { id: { in: publicationIds } }, select: { id: true, productId: true, storeId: true } });
  const productIds = [...new Set(pubs.map((p) => p.productId))];
  const since = new Date(now.getTime() - ALERT_DAYS * 86_400_000);
  const [changes, live] = await Promise.all([
    db.channelSyncChange.findMany({
      where: { field: 'category', kind: 'TAKEN', createdAt: { gte: since }, publication: { productId: { in: productIds } } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, message: true, publication: { select: { productId: true, storeId: true, externalId: true } } },
    }),
    db.publication.findMany({
      where: { productId: { in: productIds }, externalId: { not: null }, channelStatus: { in: ['ACTIVE', 'PAUSED'] }, channelCopy: { is: { missingSince: null, categoryId: { not: null } } } },
      select: { productId: true, storeId: true, channelCopy: { select: { categoryId: true } } },
    }),
  ]);
  for (const p of pubs) {
    const change = changes.find((c) => c.publication.productId === p.productId && c.publication.storeId === p.storeId);
    const categories = new Set(live.filter((l) => l.productId === p.productId && l.storeId === p.storeId).map((l) => l.channelCopy!.categoryId));
    const split = categories.size > 1;
    if (!change && !split) continue;
    const parts = [
      change ? `El canal cambió por su cuenta la categoría de ${change.publication.externalId ?? 'una publicación del producto'}: ${change.message ?? ''}`.trim() : null,
      split ? `El producto quedó con opciones activas en ${categories.size} categorías: el canal finaliza las que quedan en otra.` : null,
    ].filter(Boolean);
    out.set(p.id, { text: parts.join(' '), changedAt: change?.createdAt ?? null, split });
  }
  return out;
}

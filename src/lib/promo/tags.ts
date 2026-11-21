import type { PrismaClient } from '@/generated/prisma/client';
import { COMPETITIONS, LIFECYCLES, PRIORITIES, RULE_GROUPS, type Competition, type Lifecycle, type Priority, type TagGroup } from '@/domain/promo/tags';
import { PromoError } from './settings';

// Poner o corregir a mano las etiquetas de promociones de unos productos, y
// decidir a mano que una forma de cobro no entre a ninguna oferta. Lo puesto
// a mano queda marcado: la regla no lo pisa. Recibe la base por parámetro
// para poder probarlo.

type Db = PrismaClient;

export type TagChange = {
  // null: sin etiqueta.
  lifecycle?: Lifecycle | null;
  competition?: Competition | null;
  inCatalog?: boolean;
  stockControl?: boolean;
  priority?: Priority | null;
  // Estos grupos vuelven a quedar a cargo de la regla.
  release?: TagGroup[];
};

const check = <T extends string>(list: readonly T[], v: T | null | undefined, what: string) => {
  if (v !== null && v !== undefined && !(list as readonly string[]).includes(v)) throw new PromoError(`No se reconoce ${what}: ${v}.`);
};

/** Pone esas etiquetas en esos productos. Devuelve cuántos cambió. */
export async function setPromoTags(db: Db, args: { accountId: string; productIds: string[]; change: TagChange; userId: string | null }): Promise<number> {
  const c = args.change;
  check(LIFECYCLES, c.lifecycle, 'el ciclo de vida');
  check(COMPETITIONS, c.competition, 'la competencia');
  check(PRIORITIES, c.priority, 'la prioridad');
  const release = c.release ?? [];
  for (const g of release) if (!RULE_GROUPS.includes(g)) throw new PromoError('Solo el ciclo de vida, la competencia y "en catálogo" los propone una regla.');
  const groups = (['lifecycle', 'competition', 'inCatalog', 'stockControl', 'priority'] as const).filter((g) => c[g] !== undefined);
  if (groups.length === 0 && release.length === 0) throw new PromoError('Decí qué etiqueta poner.');
  const products = await db.product.findMany({ where: { id: { in: [...new Set(args.productIds)] }, accountId: args.accountId }, select: { id: true, promotion: { select: { manual: true } } } });
  for (const p of products) {
    const manual = new Set(p.promotion?.manual ?? []);
    // Las que propone una regla quedan marcadas como puestas a mano.
    for (const g of groups) if (RULE_GROUPS.includes(g)) manual.add(g);
    for (const g of release) manual.delete(g);
    const data = {
      ...(c.lifecycle !== undefined ? { lifecycle: c.lifecycle } : {}),
      ...(c.competition !== undefined ? { competition: c.competition } : {}),
      ...(c.inCatalog !== undefined ? { inCatalog: c.inCatalog } : {}),
      ...(c.stockControl !== undefined ? { stockControl: c.stockControl } : {}),
      ...(c.priority !== undefined ? { priority: c.priority } : {}),
      manual: [...manual],
      updatedById: args.userId,
    };
    await db.productPromotion.upsert({ where: { productId: p.id }, create: { productId: p.id, ...data }, update: data });
  }
  return products.length;
}

/** Decide a mano que unas formas de cobro no entren a ninguna oferta, o lo levanta. No las saca de donde ya están. */
export async function setOptionsExcluded(db: Db, args: { accountId: string; publicationIds: string[]; excluded: boolean; why?: string | null; userId: string | null }): Promise<number> {
  const pubs = await db.publication.findMany({ where: { id: { in: [...new Set(args.publicationIds)] }, product: { accountId: args.accountId } }, select: { id: true } });
  for (const p of pubs) {
    const data = { excluded: args.excluded, why: args.excluded ? (args.why?.trim().slice(0, 300) || null) : null, updatedById: args.userId };
    await db.promotionOption.upsert({ where: { publicationId: p.id }, create: { publicationId: p.id, ...data }, update: data });
  }
  return pubs.length;
}

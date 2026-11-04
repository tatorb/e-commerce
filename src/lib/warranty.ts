import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { familyMemberIds } from '@/domain/family-members';
import { parseWarranty, sameWarranty, WarrantyError, warrantyFromText, warrantyLabel, type Warranty } from '@/domain/warranty';

export { WarrantyError };

// La garantía de las publicaciones y la de la cuenta. Cargarla en una
// publicación la deja en el borrador: se sube desde Por subir, o sola. En una
// familia es de la familia: se guarda en todas sus medidas. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

/** La garantía de la cuenta, o null si no se definió. */
export async function accountWarranty(db: Db, accountId: string): Promise<Warranty | null> {
  const a = await db.account.findUnique({ where: { id: accountId }, select: { warranty: true } });
  return parseWarranty(a?.warranty);
}

/** Guarda la garantía de la cuenta. No cambia ninguna publicación. */
export async function setAccountWarranty(db: Db, accountId: string, warranty: Warranty | null): Promise<void> {
  await db.account.update({ where: { id: accountId }, data: { warranty: warranty === null ? Prisma.DbNull : warranty } });
}

/**
 * La garantía con la que se crea una publicación en el canal: la de la
 * publicación, si tiene; si no, la de la cuenta; si no, la que dice la ficha
 * con la forma "6 meses". De dónde salió, para decirlo.
 */
export function warrantyForCreate(
  publication: unknown,
  account: Warranty | null,
  fichaText: string | null,
): { warranty: Warranty | null; from: 'publicación' | 'cuenta' | 'ficha' | null } {
  const own = parseWarranty(publication);
  if (own) return { warranty: own, from: 'publicación' };
  if (account) return { warranty: account, from: 'cuenta' };
  const ficha = warrantyFromText(fichaText);
  return ficha ? { warranty: ficha, from: 'ficha' } : { warranty: null, from: null };
}

export type WarrantyRow = {
  id: string;
  externalId: string | null;
  title: string | null;
  // La que tiene hoy: la de la app o, si no la cambió, la del canal.
  current: string;
};

export type WarrantyPlan = {
  warranty: string;
  // Cuántas se miraron, contando las otras medidas de cada familia.
  total: number;
  // Las que van a cambiar en la app y quedan para subir.
  changing: WarrantyRow[];
  // Las que ya tienen esa garantía.
  same: number;
  // Las que todavía no están en el canal: la usan al crearse.
  unpublished: number;
  // Las pedidas que no son de la cuenta.
  notFound: string[];
};

/**
 * Carga esa garantía en las publicaciones (todas las de la cuenta sin la
 * lista). Una familia lleva la misma en todas sus medidas, aunque se pida una
 * sola. Con dryRun solo cuenta: no cambia nada. Las eliminadas no se tocan.
 */
export async function setWarranties(
  db: Db,
  args: { accountId: string; publicationIds?: string[]; warranty: Warranty; dryRun?: boolean },
): Promise<WarrantyPlan> {
  const notFound: string[] = [];
  let ids: string[];
  if (args.publicationIds) {
    const own = await db.publication.findMany({ where: { id: { in: args.publicationIds }, product: { accountId: args.accountId } }, select: { id: true } });
    const found = new Set(own.map((p) => p.id));
    notFound.push(...args.publicationIds.filter((id) => !found.has(id)));
    const all = new Set<string>();
    for (const id of found) for (const member of await familyMemberIds(db, id)) all.add(member);
    ids = [...all];
  } else {
    ids = (await db.publication.findMany({ where: { product: { accountId: args.accountId } }, select: { id: true } })).map((p) => p.id);
  }
  const rows = await db.publication.findMany({
    where: { id: { in: ids }, channelStatus: { not: 'DELETED' } },
    select: { id: true, externalId: true, title: true, warranty: true, channelCopy: { select: { warranty: true } } },
    orderBy: [{ externalId: 'asc' }, { id: 'asc' }],
  });
  const plan: WarrantyPlan = { warranty: warrantyLabel(args.warranty), total: rows.length, changing: [], same: 0, unpublished: 0, notFound };
  for (const p of rows) {
    const own = parseWarranty(p.warranty);
    const current = own ?? parseWarranty(p.channelCopy?.warranty);
    if (!p.externalId) plan.unpublished++;
    // Si la app ya la tiene puesta, o sigue al canal y el canal ya la tiene, no cambia.
    if (sameWarranty(current, args.warranty) && (own !== null || p.channelCopy?.warranty)) {
      plan.same++;
      continue;
    }
    plan.changing.push({ id: p.id, externalId: p.externalId, title: p.title, current: current ? warrantyLabel(current) : 'Sin leer del canal' });
  }
  if (args.dryRun || plan.changing.length === 0) return plan;
  // De a tandas, para no armar un pedido enorme.
  for (let i = 0; i < plan.changing.length; i += 500) {
    await db.publication.updateMany({ where: { id: { in: plan.changing.slice(i, i + 500).map((r) => r.id) } }, data: { warranty: args.warranty } });
  }
  return plan;
}

/**
 * Deja de cargar una garantía propia en la publicación y su familia: vuelven a
 * seguir a la del canal. Lo que estaba para subir deja de estarlo.
 */
export async function clearWarranty(db: Db, args: { accountId: string; publicationId: string }): Promise<number> {
  const p = await db.publication.findFirst({ where: { id: args.publicationId, product: { accountId: args.accountId } }, select: { id: true } });
  if (!p) throw new WarrantyError('La publicación no está en la cuenta.');
  const ids = await familyMemberIds(db, p.id);
  return (await db.publication.updateMany({ where: { id: { in: ids } }, data: { warranty: Prisma.DbNull } })).count;
}

/** La garantía de una publicación para mostrarla: la propia, la del canal y la de la cuenta. */
export async function warrantyOverview(db: Db, args: { accountId: string; publicationId: string }) {
  const [p, account] = await Promise.all([
    db.publication.findFirst({
      where: { id: args.publicationId, product: { accountId: args.accountId } },
      select: { externalId: true, warranty: true, channelCopy: { select: { warranty: true } }, product: { select: { warranty: true } } },
    }),
    accountWarranty(db, args.accountId),
  ]);
  if (!p) return null;
  const own = parseWarranty(p.warranty);
  const channel = parseWarranty(p.channelCopy?.warranty);
  return {
    published: Boolean(p.externalId),
    own,
    channel,
    account,
    // Con la que se crearía hoy, si todavía no está en el canal.
    forCreate: warrantyForCreate(p.warranty, account, p.product.warranty),
    // Si la propia todavía no está en el canal.
    pending: own !== null && p.externalId !== null && !sameWarranty(own, channel),
  };
}

export type WarrantyOverview = NonNullable<Awaited<ReturnType<typeof warrantyOverview>>>;

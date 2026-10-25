import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { ACTIVITY_PAGE_SIZE, kindsOf, type ActivityFilters, type ActivityRow } from '@/domain/activity';
import { dayRange } from '@/domain/sync-log';

// Lo que muestra la pantalla Actividad y lo que baja la planilla.

type Db = PrismaClient;

// Lo más que baja la planilla de una vez.
const SHEET_MAX = 10_000;

function whereOf(f: ActivityFilters, timeZone: string): Prisma.ActivityLogWhereInput {
  const kinds = kindsOf(f.types);
  const range = dayRange(f, timeZone);
  return {
    ...(f.people.length ? { userId: { in: f.people } } : {}),
    ...(f.accounts.length ? { accountId: { in: f.accounts } } : {}),
    ...(f.sections.length ? { section: { in: f.sections } } : {}),
    ...(kinds.length ? { kind: { in: kinds } } : {}),
    ...(range.gte || range.lt ? { createdAt: range } : {}),
  };
}

const SELECT = {
  id: true,
  createdAt: true,
  kind: true,
  summary: true,
  section: true,
  email: true,
  targetLabel: true,
  publicationId: true,
  productId: true,
  detail: true,
  via: true,
  user: { select: { id: true, name: true } },
  account: { select: { slug: true, name: true } },
} satisfies Prisma.ActivityLogSelect;

export async function loadActivity(db: Db, f: ActivityFilters, timeZone: string) {
  const where = whereOf(f, timeZone);
  const [entries, total, people, accounts] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      select: SELECT,
    }),
    db.activityLog.count({ where }),
    db.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.account.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  // Lo que todavía existe se puede abrir.
  const [pubs, products] = await Promise.all([
    db.publication.findMany({ where: { id: { in: entries.flatMap((e) => (e.publicationId ? [e.publicationId] : [])) } }, select: { id: true } }),
    db.product.findMany({ where: { id: { in: entries.flatMap((e) => (e.productId ? [e.productId] : [])) } }, select: { id: true } }),
  ]);
  const livePubs = new Set(pubs.map((p) => p.id));
  const liveProducts = new Set(products.map((p) => p.id));
  return {
    entries: entries.map((e) => ({
      ...e,
      href:
        e.account && e.publicationId && livePubs.has(e.publicationId)
          ? `/a/${e.account.slug}/publicaciones/${e.publicationId}`
          : e.account && e.productId && liveProducts.has(e.productId)
            ? `/a/${e.account.slug}/productos/${e.productId}`
            : null,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
    people,
    accounts,
  };
}

export type ActivityEntry = Awaited<ReturnType<typeof loadActivity>>['entries'][number];

/** Quién aparece en una entrada: la persona, o el email que escribió quien no pudo entrar. */
export function personName(e: { user: { name: string } | null; email: string | null }): string {
  return e.user?.name ?? e.email ?? 'Alguien que no está en la app';
}

/** Las filas de la planilla, con los mismos filtros. */
export async function activitySheetRows(db: Db, f: ActivityFilters, timeZone: string): Promise<ActivityRow[]> {
  const rows = await db.activityLog.findMany({ where: whereOf(f, timeZone), orderBy: { createdAt: 'desc' }, take: SHEET_MAX, select: SELECT });
  return rows.map((r) => ({
    createdAt: r.createdAt,
    kind: r.kind,
    summary: r.summary,
    section: r.section,
    person: personName(r),
    account: r.account?.name ?? null,
    target: r.targetLabel,
    detail: r.detail,
    via: r.via,
  }));
}

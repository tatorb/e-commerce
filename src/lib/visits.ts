import type { PrismaClient } from '@/generated/prisma/client';
import { ConnectError } from '@/channels/connect';
import { getChannelListings } from '@/channels/listings';
import { withAccessToken } from '@/lib/connections';
import { VISIT_HISTORY_DAYS, visitsSummary, type VisitDay, type VisitsSummary } from '@/domain/visits';

// Las visitas de cada publicación día por día, leídas del canal una vez por
// día. La primera vez se traen los últimos 90 días; después, la última
// semana, porque el canal puede corregir los días recientes. Recibe la base
// por parámetro para poder probarlo con una base de prueba y un canal simulado.

type Db = PrismaClient;

const DAY = 24 * 60 * 60 * 1000;
// Se vuelven a leer al día siguiente.
const FRESH_MS = 20 * 60 * 60 * 1000;
const RECENT_DAYS = 7;
// Cuántas publicaciones por tanda, a la vez.
const BATCH = 8;

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Guarda los días leídos de una publicación: los que ya estaban se reemplazan. */
async function saveDays(db: Db, publicationId: string, days: VisitDay[], now: Date) {
  await db.$transaction(async (tx) => {
    if (days.length > 0) {
      await tx.publicationVisitDay.deleteMany({ where: { publicationId, day: { gte: dayDate(days[0].day) } } });
      await tx.publicationVisitDay.createMany({ data: days.map((d) => ({ publicationId, day: dayDate(d.day), visits: d.visits })), skipDuplicates: true });
    }
    // Lo de más de 90 días ya no se muestra.
    await tx.publicationVisitDay.deleteMany({ where: { publicationId, day: { lt: new Date(now.getTime() - (VISIT_HISTORY_DAYS + 7) * DAY) } } });
    await tx.publication.update({ where: { id: publicationId }, data: { visitsReadAt: now } });
  });
}

export type VisitsRead = {
  read: number;
  pending: boolean;
  // Las que el canal no devolvió, con el motivo: se vuelven a probar en la próxima lectura.
  failed: { externalId: string; message: string }[];
  // Las que faltan leer hoy, contando las de esta vuelta que no se pudieron.
  left: number;
};

/**
 * Lee las visitas de las publicaciones que no se leyeron hoy, con lo que queda
 * de tiempo. Con accountId, solo las de esa cuenta; con publicationIds, solo
 * esas. Con force, también las que ya se leyeron hoy.
 */
export async function readAllVisits(
  db: Db,
  opts: { budgetMs: number; now?: () => Date; accountId?: string; publicationIds?: string[]; force?: boolean },
): Promise<VisitsRead> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  const left = () => opts.budgetMs - (clock().getTime() - started);
  const stores = await db.store.findMany({
    where: { connection: { status: 'ACTIVE' }, ...(opts.accountId ? { accountId: opts.accountId } : {}) },
    select: { id: true, channel: { select: { kind: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const out: VisitsRead = { read: 0, pending: false, failed: [], left: 0 };
  const stale = new Date(clock().getTime() - FRESH_MS);
  const dueWhere = (storeId: string) => ({
    storeId,
    externalId: { not: null },
    channelStatus: { notIn: ['DELETED' as const, 'UNPUBLISHED' as const] },
    ...(opts.publicationIds ? { id: { in: opts.publicationIds } } : {}),
    ...(opts.force ? {} : { OR: [{ visitsReadAt: null }, { visitsReadAt: { lt: stale } }] }),
  });
  for (const store of stores) {
    const channel = getChannelListings(store.channel.kind);
    if (!channel?.readDailyVisits) continue;
    if (left() <= 0) {
      out.pending = true;
      continue;
    }
    const readDailyVisits = channel.readDailyVisits.bind(channel);
    const due = await db.publication.findMany({
      where: dueWhere(store.id),
      orderBy: [{ visitsReadAt: { sort: 'asc', nulls: 'first' } }],
      take: 200,
      select: { id: true, externalId: true, visitsReadAt: true },
    });
    if (due.length === 0) continue;
    try {
      await withAccessToken(db, store.id, async (token) => {
        for (let i = 0; i < due.length; i += BATCH) {
          if (left() <= 0) {
            out.pending = true;
            return;
          }
          await Promise.all(
            due.slice(i, i + BATCH).map(async (p) => {
              const days = await readDailyVisits(token, p.externalId!, p.visitsReadAt ? RECENT_DAYS : VISIT_HISTORY_DAYS).catch((e) => {
                const message = e instanceof Error ? e.message : String(e);
                console.error('No se pudieron leer las visitas', p.externalId, message);
                out.failed.push({ externalId: p.externalId!, message });
                return undefined;
              });
              // Si falló, se vuelve a probar en la próxima lectura.
              if (days === undefined) return;
              await saveDays(db, p.id, days ?? [], clock());
              out.read++;
            }),
          );
        }
      });
    } catch (e) {
      if (!(e instanceof ConnectError)) throw e;
      out.failed.push({ externalId: '', message: e.message });
    }
  }
  // Lo que falta: lo que no se leyó todavía, salvo con force, que no deja nada pendiente.
  if (!opts.force) {
    for (const store of stores) out.left += await db.publication.count({ where: dueWhere(store.id) });
  }
  return out;
}

/** El día en que se terminó de corregir en el pipeline, el último si fueron varios. */
async function correctedAt(db: Db, publicationId: string): Promise<Date | null> {
  const m = await db.pipelineMovement.findFirst({
    where: { publicationId, exitKind: 'COMPLETED' },
    orderBy: { exitedAt: 'desc' },
    select: { exitedAt: true },
  });
  return m?.exitedAt ?? null;
}

/** Las visitas por día de una publicación y su resumen. Null si todavía no se leyeron. */
export async function loadVisits(db: Db, publicationId: string, now = new Date()): Promise<(VisitsSummary & { readAt: Date | null }) | null> {
  const [rows, pub, corrected] = await Promise.all([
    db.publicationVisitDay.findMany({
      where: { publicationId, day: { gte: new Date(now.getTime() - VISIT_HISTORY_DAYS * DAY) } },
      orderBy: { day: 'asc' },
      select: { day: true, visits: true },
    }),
    db.publication.findUnique({ where: { id: publicationId }, select: { visitsReadAt: true } }),
    correctedAt(db, publicationId),
  ]);
  const summary = visitsSummary(
    rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), visits: r.visits })),
    now,
    corrected,
  );
  return summary ? { ...summary, readAt: pub?.visitsReadAt ?? null } : null;
}

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

/** Lee las visitas de las publicaciones que no se leyeron hoy, con lo que queda de tiempo. */
export async function readAllVisits(db: Db, opts: { budgetMs: number; now?: () => Date }): Promise<{ read: number; pending: boolean }> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  const left = () => opts.budgetMs - (clock().getTime() - started);
  const stores = await db.store.findMany({
    where: { connection: { status: 'ACTIVE' } },
    select: { id: true, channel: { select: { kind: true } } },
    orderBy: { createdAt: 'asc' },
  });
  let read = 0;
  let pending = false;
  for (const store of stores) {
    const channel = getChannelListings(store.channel.kind);
    if (!channel?.readDailyVisits || left() <= 0) {
      if (channel?.readDailyVisits) pending = true;
      continue;
    }
    const readDailyVisits = channel.readDailyVisits.bind(channel);
    const stale = new Date(clock().getTime() - FRESH_MS);
    const due = await db.publication.findMany({
      where: { storeId: store.id, externalId: { not: null }, channelStatus: { notIn: ['DELETED', 'UNPUBLISHED'] }, OR: [{ visitsReadAt: null }, { visitsReadAt: { lt: stale } }] },
      orderBy: [{ visitsReadAt: { sort: 'asc', nulls: 'first' } }],
      take: 200,
      select: { id: true, externalId: true, visitsReadAt: true },
    });
    if (due.length === 0) continue;
    try {
      await withAccessToken(db, store.id, async (token) => {
        for (let i = 0; i < due.length; i += BATCH) {
          if (left() <= 0) {
            pending = true;
            return;
          }
          await Promise.all(
            due.slice(i, i + BATCH).map(async (p) => {
              const days = await readDailyVisits(token, p.externalId!, p.visitsReadAt ? RECENT_DAYS : VISIT_HISTORY_DAYS).catch((e) => {
                console.error('No se pudieron leer las visitas', p.externalId, e instanceof Error ? e.message : e);
                return undefined;
              });
              // Si falló, se vuelve a probar en la próxima lectura.
              if (days === undefined) return;
              await saveDays(db, p.id, days ?? [], clock());
              read++;
            }),
          );
        }
      });
    } catch (e) {
      if (!(e instanceof ConnectError)) throw e;
    }
  }
  return { read, pending };
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

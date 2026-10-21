import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import {
  AUTOMATIC,
  dayRange,
  LOG_MAX_PAGE,
  LOG_PAGE_SIZE,
  logKinds,
  logReads,
  mergeLog,
  type LogChange,
  type LogEntry,
  type LogFilters,
  type LogRead,
} from '@/domain/sync-log';

// Lo que muestra la pantalla Registro y lo que baja su planilla, con los mismos
// filtros. Junta los cambios de cada publicación y las lecturas del canal.

// Lo más que baja la planilla de una vez.
export const LOG_SHEET_LIMIT = 10000;

function changeWhere(accountId: string, f: LogFilters, timeZone: string): Prisma.ChannelSyncChangeWhereInput | null {
  const kinds = logKinds(f);
  if (kinds && kinds.length === 0) return null;
  const range = dayRange(f, timeZone);
  const people = f.people.filter((p) => p !== AUTOMATIC);
  const and: Prisma.ChannelSyncChangeWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { publication: { title: { contains: f.q, mode: 'insensitive' } } },
        { publication: { externalId: { contains: f.q, mode: 'insensitive' } } },
      ],
    });
  }
  if (f.people.length > 0) {
    and.push({ OR: [...(people.length > 0 ? [{ userId: { in: people } }] : []), ...(f.people.includes(AUTOMATIC) ? [{ userId: null }] : [])] });
  }
  return {
    publication: { product: { accountId }, ...(f.publicationId ? { id: f.publicationId } : {}) },
    ...(kinds ? { kind: { in: kinds } } : {}),
    ...(range.gte || range.lt ? { createdAt: range } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

function readWhere(accountId: string, f: LogFilters, timeZone: string): Prisma.ChannelSyncWhereInput | null {
  const scope = logReads(f);
  if (scope === 'none') return null;
  const range = dayRange(f, timeZone);
  const people = f.people.filter((p) => p !== AUTOMATIC);
  const and: Prisma.ChannelSyncWhereInput[] = [];
  if (scope === 'problems') and.push({ OR: [{ status: 'FAILED' }, { NOT: { errors: { equals: [] } } }] });
  if (f.people.length > 0) {
    and.push({ OR: [...(people.length > 0 ? [{ userId: { in: people } }] : []), ...(f.people.includes(AUTOMATIC) ? [{ trigger: 'SCHEDULE' as const }] : [])] });
  }
  return {
    store: { accountId },
    ...(range.gte || range.lt ? { startedAt: range } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

async function fetchLog(accountId: string, f: LogFilters, timeZone: string, take: number) {
  const cw = changeWhere(accountId, f, timeZone);
  const rw = readWhere(accountId, f, timeZone);
  const [changes, reads, changeCount, readCount] = await Promise.all([
    cw
      ? prisma.channelSyncChange.findMany({
          where: cw,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: {
            id: true,
            createdAt: true,
            kind: true,
            field: true,
            before: true,
            after: true,
            message: true,
            user: { select: { name: true } },
            publication: { select: { id: true, title: true, externalId: true, store: { select: { name: true } } } },
          },
        })
      : [],
    rw
      ? prisma.channelSync.findMany({
          where: rw,
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take,
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            status: true,
            trigger: true,
            read: true,
            total: true,
            updated: true,
            missing: true,
            errors: true,
            user: { select: { name: true } },
            store: { select: { name: true } },
          },
        })
      : [],
    cw ? prisma.channelSyncChange.count({ where: cw }) : 0,
    rw ? prisma.channelSync.count({ where: rw }) : 0,
  ]);
  const entries = mergeLog(
    changes.map(
      (c): LogChange => ({
        type: 'change',
        key: `c${c.id}`,
        at: c.createdAt,
        kind: c.kind,
        field: c.field,
        before: c.before,
        after: c.after,
        message: c.message,
        user: c.user?.name ?? null,
        publication: { id: c.publication.id, title: c.publication.title, externalId: c.publication.externalId, storeName: c.publication.store.name },
      }),
    ),
    reads.map(
      (r): LogRead => ({
        type: 'read',
        key: `r${r.id}`,
        at: r.startedAt,
        finishedAt: r.finishedAt,
        status: r.status,
        trigger: r.trigger,
        user: r.user?.name ?? null,
        storeName: r.store.name,
        read: r.read,
        total: r.total,
        updated: r.updated,
        missing: r.missing,
        errors: Array.isArray(r.errors) ? (r.errors as { at: string; message: string }[]) : [],
      }),
    ),
  );
  return { entries, total: changeCount + readCount };
}

/** Una página del Registro, con las opciones de los filtros. */
export async function loadSyncLog(accountId: string, timeZone: string, f: LogFilters) {
  const [{ entries, total }, people, publication, stores] = await Promise.all([
    // Para la página n alcanza con las n primeras páginas de cada lado.
    fetchLog(accountId, f, timeZone, f.page * LOG_PAGE_SIZE),
    prisma.user.findMany({
      where: {
        OR: [{ syncChoices: { some: { publication: { product: { accountId } } } } }, { channelSyncs: { some: { store: { accountId } } } }],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    f.publicationId
      ? prisma.publication.findFirst({ where: { id: f.publicationId, product: { accountId } }, select: { id: true, title: true, externalId: true } })
      : null,
    prisma.store.count({ where: { accountId } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  return {
    entries: entries.slice((f.page - 1) * LOG_PAGE_SIZE, f.page * LOG_PAGE_SIZE),
    total,
    pages: Math.min(pages, LOG_MAX_PAGE),
    // Hay más de lo que se puede recorrer por páginas: para ver lo anterior, se filtra por fecha.
    capped: pages > LOG_MAX_PAGE,
    people,
    publication,
    manyStores: stores > 1,
  };
}

export type SyncLog = Awaited<ReturnType<typeof loadSyncLog>>;

/** Todo lo que coincide con los filtros, para la planilla. */
export async function listSyncLog(accountId: string, timeZone: string, f: LogFilters): Promise<LogEntry[]> {
  const { entries } = await fetchLog(accountId, f, timeZone, LOG_SHEET_LIMIT);
  return entries.slice(0, LOG_SHEET_LIMIT);
}

import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { SyncTrigger } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { ConnectError } from '@/channels/connect';
import { getChannelListings, LISTINGS_BATCH, type ChannelListing } from '@/channels/listings';
import type { ChannelAdapter } from '@/channels/types';
import {
  FACE_FIELDS,
  channelFaceValues,
  faceSummary,
  faceValues,
  fingerprintsOf,
  parseFingerprints,
  planFaces,
  type FaceField,
  type FaceValues,
  type Fingerprints,
} from '@/domain/channel-sync';
import { channelPhotos } from '@/domain/media';
import { parseMetrics, type Metrics } from '@/domain/measurements';
import type { NameValue } from '@/domain/name-value';
import { isUniqueViolation } from '@/domain/publications';
import { listingAttributeIds, listingAttributes } from '@/importers/channel-listings';
import { withAccessToken } from '@/lib/connections';

// La lectura automática del canal: recorre las publicaciones de cada tienda
// conectada, guarda la cara del canal y trae a la app lo que cambió allá,
// salvo que choque con un cambio de la app. Corre por tandas y con un tope de
// tiempo por pedido: lo que no llega a leer lo sigue el próximo. Recibe la base
// por parámetro para poder probarlo con una base de prueba y un canal simulado.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

// Una pasada programada no arranca si hubo otra hace menos de esto.
const SCHEDULE_GAP_MS = 50 * 60 * 1000;
// Una pasada que no terminó en este tiempo se da por fallida y se empieza otra.
const STALE_MS = 6 * 60 * 60 * 1000;
// La descripción se vuelve a pedir aunque el canal no diga que cambió.
const DESCRIPTION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ERRORS = 50;

export class SyncError extends Error {}

type SyncErrorEntry = { at: string; message: string };

function errorsOf(raw: unknown): SyncErrorEntry[] {
  return Array.isArray(raw) ? (raw as SyncErrorEntry[]) : [];
}

function dayIn(timeZone: string, now: Date): Date {
  return new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(now)}T00:00:00Z`);
}

const asJson = (v: unknown) => (v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

// ───────────────────────────── Empezar una pasada ─────────────────────────────

/** Las tiendas que se pueden leer: conectadas y de un canal que sabe leer sus publicaciones. */
export async function syncableStores(db: Db, accountId?: string) {
  const stores = await db.store.findMany({
    where: { connection: { status: 'ACTIVE' }, ...(accountId ? { accountId } : {}) },
    select: { id: true, name: true, accountId: true, channel: { select: { kind: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return stores.filter((s) => getChannelListings(s.channel.kind) !== null);
}

/**
 * La pasada en curso de la tienda, o una nueva. Una programada no empieza si
 * hubo otra hace poco: así dos avisos seguidos no leen dos veces. Devuelve null
 * si no hay nada que hacer.
 */
export async function startSync(
  db: Db,
  args: { storeId: string; trigger: SyncTrigger; userId?: string | null; now?: Date },
): Promise<{ id: string } | null> {
  const now = args.now ?? new Date();
  const running = await db.channelSync.findFirst({ where: { storeId: args.storeId, status: 'RUNNING' }, select: { id: true, startedAt: true } });
  if (running && now.getTime() - running.startedAt.getTime() < STALE_MS) return { id: running.id };
  if (running) {
    await db.channelSync.update({
      where: { id: running.id },
      data: { status: 'FAILED', finishedAt: now, leaseUntil: null, errors: [{ at: now.toISOString(), message: 'No terminó en 6 horas: se empezó otra.' }] },
    });
  }
  if (args.trigger === 'SCHEDULE') {
    const last = await db.channelSync.findFirst({ where: { storeId: args.storeId }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } });
    if (last && now.getTime() - last.startedAt.getTime() < SCHEDULE_GAP_MS) return null;
  }
  const publications = await db.publication.findMany({
    where: { storeId: args.storeId, externalId: { not: null } },
    select: { externalId: true },
    orderBy: { externalId: 'asc' },
  });
  const ids = publications.map((p) => p.externalId!);
  try {
    return await db.channelSync.create({
      data: { storeId: args.storeId, trigger: args.trigger, userId: args.userId ?? null, startedAt: now, ids, total: ids.length },
      select: { id: true },
    });
  } catch (e) {
    // Otro pedido la empezó al mismo tiempo: se sigue esa.
    if (!isUniqueViolation(e)) throw e;
    return db.channelSync.findFirst({ where: { storeId: args.storeId, status: 'RUNNING' }, select: { id: true } });
  }
}

// ───────────────────────────── Una publicación ─────────────────────────────

type CopyRow = {
  channelUpdatedAt: Date | null;
  descriptionReadAt: Date | null;
  description: string | null;
  agreed: unknown;
};

function needsDescription(copy: CopyRow | null | undefined, listing: ChannelListing, now: Date): boolean {
  if (!copy?.descriptionReadAt) return true;
  if (now.getTime() - copy.descriptionReadAt.getTime() > DESCRIPTION_MAX_AGE_MS) return true;
  const changedAt = listing.updatedAt ? new Date(listing.updatedAt) : null;
  if (!changedAt || Number.isNaN(changedAt.getTime()) || !copy.channelUpdatedAt) return true;
  return changedAt.getTime() > copy.channelUpdatedAt.getTime();
}

function writeFace(field: FaceField, value: FaceValues[FaceField]): Prisma.PublicationUpdateInput {
  // Las fotos que se toman del canal: la publicación vuelve a seguir a las del canal.
  if (field === 'photos') return { media: Prisma.DbNull };
  if (field === 'attributes') return { attributes: value as NameValue[] };
  return { [field]: (value as string | null) ?? null };
}

/** Lo que mide el canal, para la medición del día. */
function listingMetrics(listing: ChannelListing): Metrics {
  const metrics: Metrics = {
    photo_count: listing.photos.length,
    has_video: listing.hasVideo,
    attribute_count: listing.attributeCount,
  };
  if (listing.sold !== null) metrics.sold_visible = listing.sold;
  if (listing.visits90d !== null) metrics.visits_90d = listing.visits90d;
  if (listing.quality !== null) metrics.channel_quality = listing.quality;
  return metrics;
}

/** Guarda la cara del canal de una publicación y trae a la app lo que cambió solo allá. Devuelve los datos que tomó. */
async function applyListing(
  tx: Tx,
  ctx: { syncId: string | null; adapter: ChannelAdapter; day: Date; now: Date },
  publicationId: string,
  listing: ChannelListing,
  descriptionRead: boolean,
): Promise<FaceField[]> {
  const p = await tx.publication.findUniqueOrThrow({
    where: { id: publicationId },
    select: {
      title: true,
      description: true,
      attributes: true,
      media: true,
      channelCopy: { select: { description: true, descriptionReadAt: true, agreed: true } },
    },
  });
  const app = faceValues(p);
  const channel: FaceValues = {
    title: listing.title,
    description: descriptionRead ? listing.description : (p.channelCopy?.description ?? null),
    attributes: listingAttributes(listing, ctx.adapter),
    photos: channelPhotos(listing.photos, listing.photoIds, listing.variations),
  };
  const channelPrints = fingerprintsOf(channel);
  const plans = planFaces(fingerprintsOf(app), channelPrints, parseFingerprints(p.channelCopy?.agreed));

  const agreed: Fingerprints = {};
  let update: Prisma.PublicationUpdateInput = {};
  const taken: FaceField[] = [];
  for (const plan of plans) {
    if (plan.agreed !== undefined) agreed[plan.field] = plan.agreed;
    if (!plan.take) continue;
    update = { ...update, ...writeFace(plan.field, channel[plan.field]) };
    taken.push(plan.field);
    await tx.channelSyncChange.create({
      data: {
        syncId: ctx.syncId,
        publicationId,
        field: plan.field,
        kind: 'TAKEN',
        before: asJson(app[plan.field]),
        after: asJson(channel[plan.field]),
      },
    });
  }

  // El estado, el link y el precio los maneja el canal: la app los toma siempre.
  await tx.publication.update({
    where: { id: publicationId },
    data: {
      ...update,
      channelStatus: listing.status,
      ...(listing.url ? { url: listing.url } : {}),
      ...(listing.price !== null ? { price: listing.price } : {}),
    },
  });

  const copy = {
    readAt: ctx.now,
    channelUpdatedAt: listing.updatedAt && !Number.isNaN(Date.parse(listing.updatedAt)) ? new Date(listing.updatedAt) : null,
    descriptionReadAt: descriptionRead ? ctx.now : (p.channelCopy?.descriptionReadAt ?? null),
    missingSince: null,
    title: channel.title,
    description: channel.description,
    attributes: channel.attributes,
    price: listing.price,
    status: listing.status,
    url: listing.url,
    photos: listing.photos,
    photoIds: listing.photoIds ?? [],
    variations: listing.variations,
    hasVideo: listing.hasVideo,
    details: {
      brand: listing.brand,
      partNumber: listing.partNumber,
      origin: listing.origin,
      skus: listing.skus,
      measures: listing.measures,
      categoryName: listing.categoryName,
    },
    categoryId: listing.categoryId,
    attributeIds: listingAttributeIds(listing, ctx.adapter),
    fingerprints: channelPrints,
    agreed,
  };
  await tx.channelCopy.upsert({ where: { publicationId }, create: { publicationId, ...copy }, update: copy });

  // La medición del día: se suma a la que ya había, que puede traer datos de una planilla.
  const where = { publicationId_takenAt: { publicationId, takenAt: ctx.day } };
  const before = await tx.measurement.findUnique({ where, select: { metrics: true } });
  const metrics = { ...parseMetrics(before?.metrics), ...listingMetrics(listing) };
  await tx.measurement.upsert({
    where,
    create: { publicationId, takenAt: ctx.day, source: 'IMPORT', metrics },
    update: { metrics },
  });
  return taken;
}

// ───────────────────────────── Seguir una pasada ─────────────────────────────

export type SyncProgress = { id: string; status: 'RUNNING' | 'DONE' | 'FAILED'; position: number; total: number; busy?: boolean };

/**
 * Lee tandas de la pasada hasta que se acabe el tiempo. Si otro pedido la está
 * corriendo, no hace nada. Al terminar cuenta las que quedan para elegir y las
 * que están en el canal y no en la app.
 */
export async function runSyncStep(
  db: Db,
  syncId: string,
  opts: { budgetMs: number; now?: () => Date },
): Promise<SyncProgress> {
  const clock = opts.now ?? (() => new Date());
  const started = clock();
  const claimed = await db.channelSync.updateMany({
    where: { id: syncId, status: 'RUNNING', OR: [{ leaseUntil: null }, { leaseUntil: { lt: started } }] },
    data: { leaseUntil: new Date(started.getTime() + opts.budgetMs + 60_000) },
  });
  const run = await db.channelSync.findUniqueOrThrow({
    where: { id: syncId },
    include: { store: { select: { id: true, channel: { select: { kind: true, name: true } }, account: { select: { timezone: true } } } } },
  });
  const progress = (status: SyncProgress['status'], position: number, busy?: boolean): SyncProgress => ({
    id: run.id,
    status,
    position,
    total: run.total,
    ...(busy ? { busy } : {}),
  });
  if (claimed.count === 0) return progress(run.status, run.position, run.status === 'RUNNING');

  const listings = getChannelListings(run.store.channel.kind);
  const adapter = getChannelAdapter(run.store.channel.kind, run.store.channel.name);
  const ids = Array.isArray(run.ids) ? (run.ids as string[]) : [];
  let position = run.position;
  let errors = errorsOf(run.errors);
  const addError = (message: string) => {
    errors = [...errors, { at: clock().toISOString(), message }].slice(-MAX_ERRORS);
  };

  const fail = async (message: string) => {
    addError(message);
    await db.channelSync.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: clock(), leaseUntil: null, position, errors } });
    return progress('FAILED', position);
  };
  if (!listings) return fail(`Todavía no se pueden leer las publicaciones de ${adapter.name}.`);

  try {
    while (position < ids.length && clock().getTime() - started.getTime() < opts.budgetMs) {
      const batch = ids.slice(position, position + LISTINGS_BATCH);
      const now = clock();
      const publications = await db.publication.findMany({
        where: { storeId: run.store.id, externalId: { in: batch } },
        select: { id: true, externalId: true, channelCopy: { select: { channelUpdatedAt: true, descriptionReadAt: true, description: true, agreed: true } } },
      });
      const byId = new Map(publications.map((p) => [p.externalId!, p]));
      const withDescription = new Set<string>();
      const result = await withAccessToken(db, run.store.id, (token, userId) =>
        listings.readListings(token, userId, batch, {
          description: (l) => {
            const need = needsDescription(byId.get(l.externalId)?.channelCopy, l, now);
            if (need) withDescription.add(l.externalId);
            return need;
          },
        }),
      );

      const ctx = { syncId: run.id, adapter, day: dayIn(run.store.account.timezone, now), now };
      let read = 0;
      let updated = 0;
      for (const listing of result.listings) {
        const publication = byId.get(listing.externalId);
        // Se borró de la app mientras se leía.
        if (!publication) continue;
        try {
          const taken = await db.$transaction((tx) => applyListing(tx, ctx, publication.id, listing, withDescription.has(listing.externalId)));
          read++;
          if (taken.length > 0) updated++;
        } catch (e) {
          console.error('Error al guardar lo leído del canal', listing.externalId, e instanceof Error ? e.message : e);
          addError(`${listing.externalId}: no se pudo guardar lo leído.`);
        }
      }
      const missing = result.missing.filter((id) => byId.has(id));
      if (missing.length > 0) {
        await db.channelCopy.updateMany({
          where: { publicationId: { in: missing.map((id) => byId.get(id)!.id) }, missingSince: null },
          data: { missingSince: now },
        });
        for (const id of missing) addError(`${id}: el canal no la devolvió. Puede estar borrada o ser de otra cuenta.`);
      }
      position += batch.length;
      await db.channelSync.update({
        where: { id: run.id },
        data: { position, read: { increment: read }, updated: { increment: updated }, missing: { increment: missing.length }, errors },
      });
    }
  } catch (e) {
    if (e instanceof ConnectError && e.reauth) return fail('Hay que volver a conectar la tienda: el canal no aceptó la llave.');
    const connection = await db.channelConnection.findUnique({ where: { storeId: run.store.id }, select: { status: true } });
    if (connection?.status !== 'ACTIVE') return fail('La tienda se desconectó: la pasada quedó a medias.');
    // Demasiados pedidos o una falla pasajera: se sigue en el próximo pedido.
    if (e instanceof ConnectError) addError(e.message);
    else {
      console.error('Error al leer del canal', e instanceof Error ? e.message : e);
      addError('No se pudo leer del canal. Se vuelve a probar en la próxima pasada.');
    }
    await db.channelSync.update({ where: { id: run.id }, data: { leaseUntil: null, position, errors } });
    return progress('RUNNING', position, e instanceof ConnectError && e.busy);
  }

  if (position < ids.length) {
    await db.channelSync.update({ where: { id: run.id }, data: { leaseUntil: null } });
    return progress('RUNNING', position);
  }

  const [toChoose, newInChannel] = await Promise.all([
    countToChoose(db, run.store.id),
    countNewInChannel(db, run.store.id, listings).catch(() => null),
  ]);
  await db.channelSync.update({
    where: { id: run.id },
    data: { status: 'DONE', finishedAt: clock(), leaseUntil: null, toChoose, newInChannel },
  });
  return progress('DONE', position);
}

async function countToChoose(db: Db, storeId: string): Promise<number> {
  const publications = await db.publication.findMany({
    where: { storeId, channelCopy: { isNot: null } },
    select: { title: true, description: true, attributes: true, media: true, channelCopy: { select: { fingerprints: true, agreed: true, missingSince: true } } },
  });
  return publications.filter((p) => !p.channelCopy?.missingSince && faceSummary(fingerprintsOf(faceValues(p)), p.channelCopy).choose.length > 0)
    .length;
}

/** Las activas y pausadas del canal que la app no tiene. */
async function countNewInChannel(db: Db, storeId: string, listings: NonNullable<ReturnType<typeof getChannelListings>>): Promise<number> {
  const ids = await withAccessToken(db, storeId, (token, userId) => listings.listIds(token, userId, ['active', 'paused']));
  const known = await db.publication.findMany({ where: { storeId, externalId: { in: ids } }, select: { externalId: true } });
  return ids.length - known.length;
}

/**
 * Lo que corre la tarea programada: sigue o empieza la pasada de cada tienda
 * conectada, hasta que se acabe el tiempo. pending dice si quedó algo por leer.
 */
export async function syncAllStores(db: Db, opts: { budgetMs: number; now?: () => Date }): Promise<{ pending: boolean; stores: SyncProgress[] }> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  const out: SyncProgress[] = [];
  let pending = false;
  for (const store of await syncableStores(db)) {
    const left = opts.budgetMs - (clock().getTime() - started);
    const run = await startSync(db, { storeId: store.id, trigger: 'SCHEDULE', now: clock() });
    if (!run) continue;
    if (left <= 0) {
      pending = true;
      continue;
    }
    const step = await runSyncStep(db, run.id, { budgetMs: left, now: clock });
    out.push(step);
    if (step.status === 'RUNNING') pending = true;
  }
  return { pending, stores: out };
}

/**
 * Lee una sola publicación del canal, con su descripción, y la guarda como en
 * una pasada. Sirve para ver enseguida algo que se cambió allá, y para
 * confirmar lo que se subió. Devuelve los datos que tomó, o null si el canal
 * no la devolvió.
 */
export async function readOne(db: Db, args: { accountId: string; publicationId: string; now?: Date }): Promise<FaceField[] | null> {
  const now = args.now ?? new Date();
  const p = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: {
      id: true,
      externalId: true,
      store: { select: { id: true, channel: { select: { kind: true, name: true } }, account: { select: { timezone: true } } } },
    },
  });
  if (!p) throw new SyncError('La publicación no está en la cuenta.');
  if (!p.externalId) throw new SyncError('Todavía no está publicada: no hay nada para leer del canal.');
  const listings = getChannelListings(p.store.channel.kind);
  const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
  if (!listings) throw new SyncError(`Todavía no se pueden leer las publicaciones de ${adapter.name}.`);
  const externalId = p.externalId;
  const result = await withAccessToken(db, p.store.id, (token, userId) =>
    listings.readListings(token, userId, [externalId], { description: () => true }),
  );
  const listing = result.listings.find((l) => l.externalId === externalId);
  if (!listing) {
    await db.channelCopy.updateMany({ where: { publicationId: p.id, missingSince: null }, data: { missingSince: now } });
    return null;
  }
  const ctx = { syncId: null, adapter, day: dayIn(p.store.account.timezone, now), now };
  return db.$transaction((tx) => applyListing(tx, ctx, p.id, listing, true));
}

// ───────────────────────────── Elegir ─────────────────────────────

export type ChoiceSide = 'channel' | 'app';

/**
 * Elige en los datos que estaban para elegir. Con channel, la app toma lo del
 * canal. Con app, lo de la app queda como borrador para subir. En los dos
 * casos lo acordado pasa a ser lo que está en el canal.
 */
export async function chooseFaces(
  db: Db,
  args: { accountId: string; publicationIds: string[]; side: ChoiceSide; fields?: FaceField[]; userId: string | null },
): Promise<{ publications: number; fields: number }> {
  const fields = args.fields ?? [...FACE_FIELDS];
  let publications = 0;
  let changed = 0;
  for (const publicationId of args.publicationIds) {
    const n = await db.$transaction(async (tx) => {
      const p = await tx.publication.findFirst({
        where: { id: publicationId, product: { accountId: args.accountId } },
        select: {
          title: true,
          description: true,
          attributes: true,
          media: true,
          channelCopy: {
            select: { title: true, description: true, attributes: true, photos: true, photoIds: true, variations: true, fingerprints: true, agreed: true, missingSince: true },
          },
        },
      });
      const copy = p?.channelCopy;
      if (!p || !copy || copy.missingSince) return 0;
      const app = faceValues(p);
      const channel = channelFaceValues(copy);
      const prints = parseFingerprints(copy.fingerprints);
      const agreed = parseFingerprints(copy.agreed);
      const pending = faceSummary(fingerprintsOf(app), copy).choose.filter((f) => fields.includes(f));
      if (pending.length === 0) return 0;
      let update: Prisma.PublicationUpdateInput = {};
      for (const field of pending) {
        agreed[field] = prints[field] ?? '';
        if (args.side === 'channel') update = { ...update, ...writeFace(field, channel[field]) };
        await tx.channelSyncChange.create({
          data: {
            publicationId,
            field,
            kind: args.side === 'channel' ? 'CHOSE_CHANNEL' : 'CHOSE_APP',
            before: asJson(app[field]),
            after: asJson(args.side === 'channel' ? channel[field] : app[field]),
            userId: args.userId,
          },
        });
      }
      if (Object.keys(update).length > 0) await tx.publication.update({ where: { id: publicationId }, data: update });
      await tx.channelCopy.update({ where: { publicationId }, data: { agreed } });
      return pending.length;
    });
    if (n > 0) {
      publications++;
      changed += n;
    }
  }
  return { publications, fields: changed };
}

/** Descarta el borrador de esos datos: la app vuelve a tener lo que está en el canal. */
export async function discardDrafts(
  db: Db,
  args: { accountId: string; publicationId: string; fields?: FaceField[]; userId: string | null },
): Promise<FaceField[]> {
  return db.$transaction(async (tx) => {
    const p = await tx.publication.findFirst({
      where: { id: args.publicationId, product: { accountId: args.accountId } },
      select: {
        title: true,
        description: true,
        attributes: true,
        media: true,
        channelCopy: {
          select: { title: true, description: true, attributes: true, photos: true, photoIds: true, variations: true, fingerprints: true, agreed: true, missingSince: true },
        },
      },
    });
    const copy = p?.channelCopy;
    if (!p || !copy || copy.missingSince) return [];
    const app = faceValues(p);
    const channel = channelFaceValues(copy);
    const drafts = faceSummary(fingerprintsOf(app), copy).draft.filter((f) => !args.fields || args.fields.includes(f));
    let update: Prisma.PublicationUpdateInput = {};
    for (const field of drafts) {
      update = { ...update, ...writeFace(field, channel[field]) };
      await tx.channelSyncChange.create({
        data: { publicationId: args.publicationId, field, kind: 'DISCARDED', before: asJson(app[field]), after: asJson(channel[field]), userId: args.userId },
      });
    }
    if (drafts.length > 0) await tx.publication.update({ where: { id: args.publicationId }, data: update });
    return drafts;
  });
}

import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { getChannelPublisher, PUBLISH_FIELDS, PublishError, type PublishField } from '@/channels/publish';
import { faceSummary, faceValues, fingerprint, fingerprintsOf, parseFingerprints, parseRejections, type FaceField } from '@/domain/channel-sync';
import { writeContentField } from '@/domain/content';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';
import { checkTitle } from '@/domain/titles';
import { readOne } from '@/lib/channel-sync';
import { withAccessToken } from '@/lib/connections';
import { loadTitleRules } from '@/lib/title-rules';

// Subir al canal el borrador de una publicación: lo que cambió en la app y
// todavía no está allá. Antes de subir se revisa lo mismo que en la app (el
// título bloqueado y las reglas de título); si el canal no acepta un dato,
// queda anotado el motivo. Después de subir, se vuelve a leer la publicación
// para confirmar. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class PushError extends Error {}

const isPublishable = (f: FaceField): f is PublishField => (PUBLISH_FIELDS as string[]).includes(f);

const LOCKED_TITLE =
  'El título está bloqueado porque la publicación tiene ventas: el canal no deja cambiarlo. Para probar uno nuevo, decidí en el paso Título si se prueba en una copia con cuotas.';

async function loadForPush(db: Db, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      productId: true,
      externalId: true,
      title: true,
      description: true,
      attributes: true,
      titleLockedManual: true,
      store: { select: { id: true, channel: { select: { id: true, kind: true, name: true } }, connection: { select: { status: true } } } },
      measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { metrics: true } },
      channelCopy: {
        select: { title: true, description: true, attributes: true, fingerprints: true, agreed: true, rejections: true, missingSince: true },
      },
    },
  });
  if (!p) throw new PushError('La publicación no está en la cuenta.');
  return p;
}

type Loaded = Awaited<ReturnType<typeof loadForPush>>;

function titleLocked(p: Loaded): boolean {
  const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
  return resolveTitleLock(adapter.titleLock(latestMetrics(p.measurements)), p.titleLockedManual, Boolean(p.externalId)).locked === true;
}

export type PushResult = {
  sent: FaceField[];
  // Lo que no se subió, con el motivo: lo que el canal no aceptó y lo que la app no dejó subir.
  rejected: { field: FaceField; message: string }[];
  // Si se pudo volver a leer la publicación después de subir.
  confirmed: boolean;
};

/**
 * Sube el borrador de esos datos, o de todos. Solo sube lo que cambió en la
 * app; lo que cambió también en el canal hay que elegirlo antes.
 */
export async function pushDrafts(
  db: Db,
  args: { accountId: string; publicationId: string; fields?: FaceField[]; userId: string | null; now?: Date },
): Promise<PushResult> {
  const now = args.now ?? new Date();
  const p = await loadForPush(db, args.accountId, args.publicationId);
  const channelName = p.store.channel.name;
  const publisher = getChannelPublisher(p.store.channel.kind);
  if (!p.externalId) throw new PushError(`Todavía no está publicada en ${channelName}: primero hay que crearla allá.`);
  if (!publisher) throw new PushError(`Todavía no se pueden subir cambios a ${channelName}.`);
  if (p.store.connection?.status !== 'ACTIVE') throw new PushError(`La tienda no está conectada con ${channelName}: conectala en Conexión.`);
  const copy = p.channelCopy;
  if (!copy) throw new PushError(`Primero hay que leerla de ${channelName}.`);
  if (copy.missingSince) throw new PushError(`${channelName} no la devuelve: puede estar borrada o ser de otra cuenta.`);

  const app = faceValues(p);
  const appPrints = fingerprintsOf(app);
  const summary = faceSummary(appPrints, copy);
  const wanted = args.fields ?? [...summary.draft, ...summary.choose];
  const result: PushResult = { sent: [], rejected: [], confirmed: false };
  const toSend: PublishField[] = [];
  for (const field of wanted) {
    if (summary.choose.includes(field)) {
      result.rejected.push({ field, message: `Cambió también en ${channelName}: primero elegí cuál queda.` });
    } else if (!summary.draft.includes(field)) {
      continue;
    } else if (!isPublishable(field)) {
      result.rejected.push({ field, message: 'Los datos de catálogo todavía no se suben desde la app.' });
    } else if (field === 'title' && titleLocked(p)) {
      result.rejected.push({ field, message: LOCKED_TITLE });
    } else if (field === 'title') {
      const { rules } = await loadTitleRules(db, args.accountId, p.store.channel);
      const check = checkTitle(app.title ?? '', rules);
      if (check.errors.length > 0) result.rejected.push({ field, message: check.errors.join(' ') });
      else toSend.push(field);
    } else if (!app.description?.trim()) {
      result.rejected.push({ field, message: 'La descripción está vacía: el canal no deja borrarla.' });
    } else toSend.push(field);
  }

  for (const field of toSend) {
    const value = (app[field] ?? '').trim();
    try {
      await withAccessToken(db, p.store.id, (token) => publisher.update(token, p.externalId!, field, value));
    } catch (e) {
      if (!(e instanceof PublishError)) throw e;
      result.rejected.push({ field, message: e.message });
      const rejections = parseRejections(copy.rejections);
      rejections[field] = { message: e.message, at: now.toISOString(), fingerprint: appPrints[field] };
      await db.channelCopy.update({ where: { publicationId: p.id }, data: { rejections } });
      copy.rejections = rejections;
      continue;
    }
    // Ya está en el canal: la cara del canal y lo acordado pasan a ser lo que se subió.
    // Si el canal lo guardó un poco distinto, la lectura de confirmación lo trae.
    const print = fingerprint(field, value);
    await db.$transaction(async (tx) => {
      const current = await tx.channelCopy.findUniqueOrThrow({ where: { publicationId: p.id }, select: { fingerprints: true, agreed: true, rejections: true } });
      const rejections = parseRejections(current.rejections);
      delete rejections[field];
      await tx.channelCopy.update({
        where: { publicationId: p.id },
        data: {
          [field]: value,
          fingerprints: { ...parseFingerprints(current.fingerprints), [field]: print },
          agreed: { ...parseFingerprints(current.agreed), [field]: print },
          rejections,
        },
      });
      await tx.channelSyncChange.create({
        data: {
          publicationId: p.id,
          field,
          kind: 'SENT',
          before: (copy[field] ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          after: value,
          userId: args.userId,
        },
      });
    });
    result.sent.push(field);
  }

  if (result.sent.length > 0) {
    // Desde cuándo está en el canal: el punto de partida para medir el antes y el después.
    await db.channelApplication.create({
      data: { publicationId: p.id, method: 'API', appliedAt: now, fields: result.sent, createdById: args.userId },
    });
    try {
      result.confirmed = (await readOne(db, { accountId: args.accountId, publicationId: p.id })) !== null;
    } catch (e) {
      console.error('No se pudo volver a leer después de subir', e instanceof Error ? e.message : e);
    }
  }
  return result;
}

export class DraftError extends Error {}

/**
 * Cambia el título o la descripción en la app, sin pasar por el pipeline. Queda
 * como borrador hasta que se sube. El título usa el mismo chequeo que el paso
 * Título. Devuelve los avisos del chequeo.
 */
export async function saveDraft(
  db: Db,
  args: { accountId: string; publicationId: string; field: PublishField; value: string },
): Promise<{ warnings: string[] }> {
  const p = await loadForPush(db, args.accountId, args.publicationId);
  const value = args.field === 'title' ? args.value.replace(/\s+/g, ' ').trim() : args.value.replace(/\r\n?/g, '\n').trim();
  let warnings: string[] = [];
  if (args.field === 'title') {
    if (!value) throw new DraftError('El título no puede quedar vacío.');
    if (titleLocked(p) && p.title?.trim() && value !== p.title.trim()) throw new DraftError(LOCKED_TITLE);
    const { rules } = await loadTitleRules(db, args.accountId, p.store.channel);
    const check = checkTitle(value, rules);
    if (check.errors.length > 0) throw new DraftError(`No se guardó: ${check.errors.join(' ')}`);
    warnings = check.warnings;
  } else if (value.length > 50000) {
    throw new DraftError('La descripción puede tener hasta 50.000 caracteres.');
  }
  await db.$transaction((tx) => writeContentField(tx, { productId: p.productId, publicationId: p.id }, args.field, value || null));
  return { warnings };
}

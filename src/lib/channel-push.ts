import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import {
  getChannelPublisher,
  PUBLISH_FIELDS,
  PublishError,
  type ChannelAttributeUpdate,
  type ChannelPublisher,
  type PublishField,
} from '@/channels/publish';
import { ConnectError } from '@/channels/connect';
import type { ChannelAdapter } from '@/channels/types';
import { CatalogError, cleanCatalogValue, findField, normalizeText } from '@/domain/catalog-data';
import {
  attributeDiff,
  channelFaceValues,
  faceSummary,
  faceValues,
  fingerprint,
  fingerprintsOf,
  mergeAttributes,
  parseFingerprints,
  parseRejections,
  type FaceField,
  type FaceValues,
} from '@/domain/channel-sync';
import { channelPhotos, type PhotoRef } from '@/domain/media';
import type { NameValue } from '@/domain/name-value';
import { writeContentField } from '@/domain/content';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';
import { checkTitle } from '@/domain/titles';
import { readOne } from '@/lib/channel-sync';
import { photoOriginsOf, picturesFor } from '@/lib/media';
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

const asJson = (v: unknown) => (v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

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
      media: true,
      titleLockedManual: true,
      store: { select: { id: true, channel: { select: { id: true, kind: true, name: true } }, connection: { select: { status: true } } } },
      measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { metrics: true } },
      channelCopy: {
        select: {
          title: true,
          description: true,
          attributes: true,
          fingerprints: true,
          agreed: true,
          rejections: true,
          missingSince: true,
          categoryId: true,
          attributeIds: true,
          photos: true,
          photoIds: true,
          photoOrigins: true,
        },
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

const names = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`);

function parseAttributeIds(raw: unknown): Record<string, { id: string; multiple: boolean }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, { id: string; multiple: boolean }> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as { id?: unknown; multiple?: unknown } | null;
    if (v && typeof v.id === 'string') out[key] = { id: v.id, multiple: v.multiple === true };
  }
  return out;
}

/**
 * Qué datos de catálogo se suben: los que cambiaron o son nuevos en la app,
 * con el código de su campo en el canal. Sale de la categoría que tiene la
 * publicación en el canal o, si la app no la conoce, de lo que se leyó. Lo que
 * no se puede subir vuelve en problems, con el motivo.
 */
function planAttributes(
  app: FaceValues,
  channel: FaceValues,
  copy: { categoryId: string | null; attributeIds: unknown },
  adapter: ChannelAdapter,
): { updates: ChannelAttributeUpdate[]; sent: NameValue[]; problems: string[] } {
  const diff = attributeDiff(app.attributes, channel.attributes);
  const category = copy.categoryId ? (adapter.catalog?.category(copy.categoryId) ?? null) : null;
  const own = category?.fields.filter((f) => !f.fromProduct) ?? [];
  const ids = parseAttributeIds(copy.attributeIds);
  const plan = { updates: [] as ChannelAttributeUpdate[], sent: [] as NameValue[], problems: [] as string[] };
  const unknown: string[] = [];
  for (const a of [...diff.changed.map((c) => ({ name: c.name, value: c.to })), ...diff.added]) {
    const field = findField(own, a.name);
    if (field) {
      try {
        plan.updates.push({ id: field.id, value: cleanCatalogValue(field, a.value) ?? a.value, multiple: Boolean(field.multiple) });
        plan.sent.push(a);
      } catch (e) {
        if (!(e instanceof CatalogError)) throw e;
        plan.problems.push(e.message);
      }
      continue;
    }
    const known = ids[normalizeText(a.name)];
    if (known) {
      plan.updates.push({ id: known.id, value: a.value, multiple: known.multiple });
      plan.sent.push(a);
    } else if (category?.fields.some((f) => f.fromProduct && normalizeText(f.label) === normalizeText(a.name))) {
      plan.problems.push(`${a.name} sale de la ficha del producto: no se sube desde los datos de catálogo.`);
    } else unknown.push(a.name);
  }
  if (unknown.length > 0) {
    plan.problems.push(`${names(unknown.map((n) => `«${n}»`))} no ${unknown.length > 1 ? 'son campos' : 'es un campo'} de la categoría en ${adapter.name}.`);
  }
  if (diff.removed.length > 0) {
    plan.problems.push(
      `${names(diff.removed.map((a) => `«${a.name}»`))} ${diff.removed.length > 1 ? 'están' : 'está'} en ${adapter.name} y no en la app: para borrarlo hay que hacerlo allá.`,
    );
  }
  return plan;
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
  const channel = channelFaceValues(copy);
  const appPrints = fingerprintsOf(app);
  const summary = faceSummary(appPrints, copy);
  const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
  const wanted = args.fields ?? [...summary.draft, ...summary.choose];
  const result: PushResult = { sent: [], rejected: [], confirmed: false };

  // Anota lo que no se subió y por qué, mientras la app tenga ese mismo valor.
  const reject = async (field: FaceField, message: string) => {
    result.rejected.push({ field, message });
    const rejections = parseRejections(copy.rejections);
    rejections[field] = { message, at: now.toISOString(), fingerprint: appPrints[field] };
    await db.channelCopy.update({ where: { publicationId: p.id }, data: { rejections } });
    copy.rejections = rejections;
  };

  // Ya está en el canal: la cara del canal y lo acordado pasan a ser lo que se subió.
  // Si el canal lo guardó un poco distinto, la lectura de confirmación lo trae.
  const accept = async (field: FaceField, value: string | NameValue[]) => {
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
          before: (channel[field] ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          after: value as Prisma.InputJsonValue,
          userId: args.userId,
        },
      });
    });
    copy.rejections = parseRejections(copy.rejections);
    delete (copy.rejections as Record<string, unknown>)[field];
    result.sent.push(field);
  };

  // Cada intento que no se subió queda en el historial, con el motivo.
  const logRejected = async () => {
    if (result.rejected.length === 0) return;
    await db.channelSyncChange.createMany({
      data: result.rejected.map((r) => ({
        publicationId: p.id,
        field: r.field,
        kind: 'REJECTED' as const,
        before: asJson(channel[r.field]),
        after: asJson(app[r.field]),
        message: r.message,
        userId: args.userId,
      })),
    });
  };

  let current: FaceField | null = null;
  try {
    for (const field of wanted) {
      current = field;
      if (summary.choose.includes(field)) {
        result.rejected.push({ field, message: `Cambió también en ${channelName}: primero elegí cuál queda.` });
        continue;
      }
      if (!summary.draft.includes(field) || !isPublishable(field)) continue;
      if (field === 'photos') {
        await pushPhotos(db, { p, publisher, refs: app.photos ?? [], before: channel.photos ?? [], userId: args.userId, reject });
        if (!result.rejected.some((r) => r.field === 'photos')) result.sent.push('photos');
        continue;
      }
      let send: () => Promise<void>;
      let value: string | NameValue[];
      let problems: string[] = [];
      if (field === 'attributes') {
        const plan = planAttributes(app, channel, copy, adapter);
        problems = plan.problems;
        if (plan.updates.length === 0) {
          await reject(field, problems.join(' ') || 'No hay datos de catálogo para subir.');
          continue;
        }
        value = mergeAttributes(channel.attributes, plan.sent);
        send = () => withAccessToken(db, p.store.id, (token) => publisher.updateAttributes(token, p.externalId!, plan.updates));
      } else {
        if (field === 'title' && titleLocked(p)) {
          result.rejected.push({ field, message: LOCKED_TITLE });
          continue;
        }
        if (field === 'title') {
          const { rules } = await loadTitleRules(db, args.accountId, p.store.channel);
          const check = checkTitle(app.title ?? '', rules);
          if (check.errors.length > 0) {
            result.rejected.push({ field, message: check.errors.join(' ') });
            continue;
          }
        } else if (!app.description?.trim()) {
          result.rejected.push({ field, message: 'La descripción está vacía: el canal no deja borrarla.' });
          continue;
        }
        const text = (app[field] ?? '').trim();
        value = text;
        send = () => withAccessToken(db, p.store.id, (token) => publisher.update(token, p.externalId!, field, text));
      }
      try {
        await send();
      } catch (e) {
        if (!(e instanceof PublishError)) throw e;
        await reject(field, [e.message, ...problems].join(' '));
        continue;
      }
      await accept(field, value);
      // Lo que quedó sin subir de los datos de catálogo, con su motivo.
      if (problems.length > 0) await reject(field, problems.join(' '));
    }
  } catch (e) {
    // Si se cortó la conexión con el canal, lo que se estaba subiendo también queda anotado.
    if (e instanceof ConnectError && current) result.rejected.push({ field: current, message: e.message });
    await logRejected().catch((err) => console.error('No se pudo anotar el intento', err instanceof Error ? err.message : err));
    throw e;
  }
  await logRejected();

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

/**
 * Sube las fotos elegidas, en orden. Si sale bien, la publicación vuelve a
 * seguir a las fotos del canal, que ya son esas, y queda anotado de qué foto
 * corregida salió cada una.
 */
async function pushPhotos(
  db: Db,
  args: {
    p: Loaded;
    publisher: ChannelPublisher;
    refs: PhotoRef[];
    before: PhotoRef[];
    userId: string | null;
    reject: (field: FaceField, message: string) => Promise<void>;
  },
): Promise<void> {
  const { p, refs } = args;
  const { pictures, origins, problems } = await picturesFor(db, p.productId, refs);
  if (problems.length > 0 || pictures.length === 0) return args.reject('photos', problems.join(' ') || 'Elegí al menos una foto.');
  let ids: string[] | null;
  try {
    ids = await withAccessToken(db, p.store.id, (token) => args.publisher.updatePictures(token, p.externalId!, pictures));
  } catch (e) {
    if (!(e instanceof PublishError)) throw e;
    return args.reject('photos', e.message);
  }
  const known = new Map(args.before.map((r) => [r.kind === 'channel' ? r.id : '', r.kind === 'channel' ? r.url : '']));
  await db.$transaction(async (tx) => {
    const current = await tx.channelCopy.findUniqueOrThrow({
      where: { publicationId: p.id },
      select: { fingerprints: true, agreed: true, rejections: true, photoOrigins: true },
    });
    const rejections = parseRejections(current.rejections);
    delete rejections.photos;
    const data: Prisma.ChannelCopyUpdateInput = { rejections };
    // Con los códigos que devolvió el canal, la cara del canal ya tiene las fotos nuevas.
    if (ids && ids.length === pictures.length) {
      const urls = pictures.map((pic, i) => (pic.kind === 'link' ? pic.url : (known.get(ids![i]) ?? '')));
      const print = fingerprint('photos', channelPhotos(urls, ids));
      const added = Object.fromEntries(ids.flatMap((id, i) => (origins[i] ? [[id, origins[i]]] : [])));
      Object.assign(data, {
        photos: urls,
        photoIds: ids,
        fingerprints: { ...parseFingerprints(current.fingerprints), photos: print },
        agreed: { ...parseFingerprints(current.agreed), photos: print },
        photoOrigins: { ...photoOriginsOf(current.photoOrigins), ...added },
      });
    }
    await tx.channelCopy.update({ where: { publicationId: p.id }, data });
    await tx.publication.update({ where: { id: p.id }, data: { media: Prisma.DbNull } });
    await tx.channelSyncChange.create({
      data: {
        publicationId: p.id,
        field: 'photos',
        kind: 'SENT',
        before: args.before as Prisma.InputJsonValue,
        after: refs as Prisma.InputJsonValue,
        userId: args.userId,
      },
    });
  });
}

export class DraftError extends Error {}

/**
 * Cambia el título o la descripción en la app, sin pasar por el pipeline. Queda
 * como borrador hasta que se sube. El título usa el mismo chequeo que el paso
 * Título. Devuelve los avisos del chequeo.
 */
export async function saveDraft(
  db: Db,
  args: { accountId: string; publicationId: string; field: 'title' | 'description'; value: string },
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

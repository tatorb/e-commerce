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
  discountText,
  FACE_FIELDS,
  faceSummary,
  faceValues,
  fingerprint,
  fingerprintsOf,
  mergeAttributes,
  parseFingerprints,
  parseRejections,
  RENEWAL_FAILED,
  type FaceField,
  type FaceValues,
} from '@/domain/channel-sync';
import { channelPhotos, parseVariantListings, parseVariations, variantKey, withMarks, type ChannelVariation, type PhotoRef } from '@/domain/media';
import { quantityKey, totalQuantity, type QuantityLine } from '@/domain/quantities';
import { needsReactivation } from '@/domain/channel-status';
import type { NameValue } from '@/domain/name-value';
import { writeContentField } from '@/domain/content';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';
import { resolveTitleLock } from '@/domain/title-lock';
import { isInstallmentPlan } from '@/domain/pricing';
import { checkTitle } from '@/domain/titles';
import { readOne } from '@/lib/channel-sync';
import { photoOriginsOf, picturesFor } from '@/lib/media';
import { withAccessToken } from '@/lib/connections';
import { listingTargets } from '@/lib/variant-listings';
import { loadTitleRules } from '@/lib/title-rules';
import { STOCK_MANAGED, stockManaged } from '@/lib/stock-plan';
import { afterRestock } from '@/lib/restock';

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
      variantListings: true,
      channelStatus: true,
      title: true,
      description: true,
      attributes: true,
      media: true,
      price: true,
      installments: true,
      discount: true,
      quantities: true,
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
          variations: true,
          price: true,
          installments: true,
          discount: true,
          discountUntil: true,
          quantity: true,
          stockInChannel: true,
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

/** Hace lo mismo en cada publicación del canal, en orden. Si una no lo acepta, se corta ahí. */
async function eachTarget(p: Pick<Loaded, 'externalId' | 'variantListings'>, run: (externalId: string) => Promise<void>): Promise<void> {
  for (const id of listingTargets(p)) await run(id);
}

/**
 * Pone el descuento en cada publicación del canal. Devuelve hasta cuándo dura:
 * si cada una tiene su fin, el primero.
 */
async function setDiscounts(
  db: Db,
  p: Pick<Loaded, 'externalId' | 'variantListings'> & { store: { id: string } },
  publisher: ChannelPublisher,
  discount: { pct: number; listPrice: number },
  now: Date,
): Promise<Date | null> {
  let until: Date | null = null;
  await withAccessToken(db, p.store.id, (token) =>
    eachTarget(p, async (id) => {
      const end = (await publisher.setDiscount(token, id, discount, now)).until;
      if (end && (!until || end < until)) until = end;
    }),
  );
  return until;
}

/** Lo que guarda la copia del canal del descuento que subió la app: con 0 no hay nada que renovar. */
const discountDates = (pct: number, until: Date | null, now: Date) =>
  pct > 0 && until ? { discountUntil: until, discountSentAt: now } : { discountUntil: null, discountSentAt: null };

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

/** Sube las cantidades: si el canal guarda cada medida aparte, cada una lleva la suya. */
export async function sendQuantities(
  db: Db,
  p: { externalId: string | null; variantListings: unknown; store: { id: string } },
  publisher: ChannelPublisher,
  lines: QuantityLine[],
): Promise<void> {
  const family = parseVariantListings(p.variantListings);
  await withAccessToken(db, p.store.id, async (token) => {
    if (family.length >= 2) {
      for (const [i, v] of family.entries()) {
        const line = lines.find((l) => l.key === quantityKey(v, i));
        if (line) await publisher.setQuantity(token, v.externalId, [{ key: '', quantity: line.quantity }]);
      }
    } else await publisher.setQuantity(token, p.externalId!, lines.map((l) => ({ key: l.key, quantity: l.quantity })));
  });
}

/** La cara del canal después de subir las cantidades: el total y la de cada medida. */
export function quantityCopy(rawVariations: unknown, lines: QuantityLine[]): Prisma.ChannelCopyUpdateInput {
  const byKey = new Map(lines.map((l) => [l.key, l.quantity]));
  const variations = parseVariations(rawVariations).map((v, i) => ({ ...v, quantity: byKey.get(quantityKey(v, i)) ?? v.quantity ?? null }));
  const known = variations.every((v) => v.quantity !== null);
  return variations.length > 0 ? { variations, quantity: known ? variations.reduce((sum, v) => sum + (v.quantity ?? 0), 0) : null } : { quantity: totalQuantity(lines) };
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
  const accept = async (field: FaceField, value: string | NameValue[] | QuantityLine[], extra: Prisma.ChannelCopyUpdateInput = {}) => {
    const print = fingerprint(field, value);
    await db.$transaction(async (tx) => {
      const current = await tx.channelCopy.findUniqueOrThrow({ where: { publicationId: p.id }, select: { fingerprints: true, agreed: true, rejections: true } });
      const rejections = parseRejections(current.rejections);
      delete rejections[field];
      await tx.channelCopy.update({
        where: { publicationId: p.id },
        data: {
          // Las cantidades van en extra: el total y la de cada medida.
          ...(field === 'quantity' ? {} : { [field]: field === 'installments' ? Number(value) : value }),
          ...extra,
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
      // Las cantidades vuelven a seguir a las del canal, que ya son esas.
      if (field === 'quantity') await tx.publication.update({ where: { id: p.id }, data: { quantities: Prisma.DbNull } });
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

  // En el orden de las caras: el precio antes que las cuotas y el descuento. El
  // canal calcula el descuento sobre el precio: si el precio cambia, el
  // descuento que ya estaba se vuelve a subir.
  const fields = FACE_FIELDS.filter((f) => wanted.includes(f) || (f === 'discount' && wanted.includes('price')));
  let resendDiscount = false;
  // La cantidad que repone stock a una publicación frenada sin stock, si se sube.
  let restock: QuantityLine[] | null = null;
  let current: FaceField | null = null;
  try {
    for (const field of fields) {
      current = field;
      const resend = field === 'discount' && resendDiscount && (app.discount === channel.discount || summary.draft.includes(field));
      if (!wanted.includes(field) && !resend) continue;
      if (summary.choose.includes(field)) {
        result.rejected.push({ field, message: `Cambió también en ${channelName}: primero elegí cuál queda.` });
        continue;
      }
      if ((!summary.draft.includes(field) && !resend) || !isPublishable(field)) continue;
      if (field === 'photos') {
        await pushPhotos(db, { p, publisher, refs: app.photos ?? [], before: channel.photos ?? [], userId: args.userId, reject });
        if (!result.rejected.some((r) => r.field === 'photos')) result.sent.push('photos');
        continue;
      }
      let send: () => Promise<void>;
      let value: string | NameValue[] | QuantityLine[];
      let problems: string[] = [];
      let extra: Prisma.ChannelCopyUpdateInput = {};
      if (field === 'attributes') {
        const plan = planAttributes(app, channel, copy, adapter);
        problems = plan.problems;
        if (plan.updates.length === 0) {
          await reject(field, problems.join(' ') || 'No hay datos de catálogo para subir.');
          continue;
        }
        value = mergeAttributes(channel.attributes, plan.sent);
        send = () => withAccessToken(db, p.store.id, (token) => eachTarget(p, (id) => publisher.updateAttributes(token, id, plan.updates)));
      } else if (field === 'price') {
        const price = Number(app.price);
        if (!app.price || !(price > 0)) {
          result.rejected.push({ field, message: 'Falta el precio: decidilo en el paso Precio.' });
          continue;
        }
        value = app.price;
        send = () => withAccessToken(db, p.store.id, (token) => eachTarget(p, (id) => publisher.updatePrice(token, id, price)));
      } else if (field === 'installments') {
        const plan = Number(app.installments);
        if (app.installments === null || !isInstallmentPlan(plan)) {
          result.rejected.push({ field, message: 'Faltan las cuotas: decidilas en el paso Precio.' });
          continue;
        }
        value = app.installments;
        send = () => withAccessToken(db, p.store.id, (token) => eachTarget(p, (id) => publisher.setInstallments(token, id, plan)));
      } else if (field === 'discount') {
        const pct = Number(app.discount);
        if (app.discount === null || !(pct >= 0)) {
          result.rejected.push({ field, message: 'Falta el descuento: decidilo en el paso Precio.' });
          continue;
        }
        // Sobre el precio que quedó en el canal.
        const listPrice = Number((result.sent.includes('price') ? app.price : channel.price) ?? 0);
        value = app.discount;
        send = async () => {
          extra = discountDates(pct, await setDiscounts(db, p, publisher, { pct, listPrice }, now), now);
        };
      } else if (field === 'quantity') {
        const lines = app.quantity;
        if (!lines) continue;
        if (copy.stockInChannel) {
          result.rejected.push({ field, message: `El stock lo maneja ${channelName}, por ejemplo porque está en Full: la cantidad no se cambia desde la app.` });
          continue;
        }
        if (await stockManaged(db, p.id)) {
          result.rejected.push({ field, message: STOCK_MANAGED });
          continue;
        }
        value = lines;
        send = () => sendQuantities(db, p, publisher, lines);
        extra = quantityCopy(copy.variations, lines);
        if (needsReactivation(p.channelStatus, channel.quantity, lines)) restock = lines;
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
        send = () => withAccessToken(db, p.store.id, (token) => eachTarget(p, (id) => publisher.update(token, id, field, text)));
      }
      try {
        await send();
      } catch (e) {
        if (!(e instanceof PublishError)) throw e;
        await reject(field, [e.message, ...problems].join(' '));
        continue;
      }
      await accept(field, value, extra);
      if (field === 'price' && Number(app.discount) > 0) resendDiscount = true;
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
    // Recién leída: si sigue frenada después de recibir stock, una tarea.
    if (restock && result.sent.includes('quantity')) await afterRestock(db, { publicationId: p.id, lines: restock, read: false });
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
  const { pictures, origins, problems, layout, sent } = await picturesFor(db, p.productId, refs);
  if (problems.length > 0 || pictures.length === 0) return args.reject('photos', problems.join(' ') || 'Elegí al menos una foto.');
  let ids: string[] | null;
  // Si el canal guarda cada medida aparte, cada una lleva lo que ve el comprador en esa medida.
  const family = parseVariantListings(p.variantListings);
  let variations: ChannelVariation[] | null = null;
  try {
    if (family.length >= 2) {
      const own = family.map((v) => ({
        ...v,
        pictures: layout.variants.find((x) => variantKey(x) === variantKey(v))?.pictures ?? layout.general,
      }));
      const each = await withAccessToken(db, p.store.id, (token) => args.publisher.updateSeparatePictures(token, own, pictures));
      // El código de cada foto, por su lugar en la lista.
      const byIndex = new Map<number, string>();
      own.forEach((v, j) => {
        const valid = v.pictures.filter((i) => i >= 0 && i < pictures.length);
        each[j]?.forEach((id, k) => byIndex.set(valid[k], id));
      });
      ids = pictures.every((_, i) => byIndex.has(i)) ? pictures.map((_, i) => byIndex.get(i)!) : null;
      variations = own.map((v, j) => ({ externalId: v.externalId, sku: v.sku, measure: v.measure, photoIds: each[j] ?? [] }));
    } else {
      ids = await withAccessToken(db, p.store.id, (token) => args.publisher.updatePictures(token, p.externalId!, pictures, layout));
    }
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
      // Con las medidas con que se subió cada una; la lectura de confirmación trae las del canal.
      const print = fingerprint(
        'photos',
        channelPhotos(urls, ids).map((ref, i) => withMarks(ref, sent[i])),
      );
      const added = Object.fromEntries(ids.flatMap((id, i) => (origins[i] ? [[id, origins[i]]] : [])));
      Object.assign(data, {
        photos: urls,
        photoIds: ids,
        ...(variations ? { variations } : {}),
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

// ───────────────────────────── Renovar el descuento ─────────────────────────────

// Cuánto antes de que venza se vuelve a subir, para que no se corte.
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export type RenewResult = { renewed: number; failed: number; pending: boolean };

/**
 * Lo que corre cada hora con la lectura del canal: el descuento que subió la
 * app y está por vencer, o ya venció, se vuelve a subir solo por otros días.
 * Es lo único que la app sube sin que nadie toque Subir, y queda en el
 * Registro. Si el canal no lo acepta, queda el motivo en Por subir y no se
 * insiste hasta que se suba a mano.
 */
export async function renewDiscounts(db: Db, opts: { budgetMs: number; now?: () => Date }): Promise<RenewResult> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  const due = await db.channelCopy.findMany({
    where: {
      discountUntil: { lt: new Date(started + RENEW_BEFORE_MS) },
      missingSince: null,
      publication: { externalId: { not: null }, store: { connection: { status: 'ACTIVE' } } },
    },
    orderBy: { discountUntil: 'asc' },
    select: { publicationId: true, publication: { select: { product: { select: { accountId: true } } } } },
  });
  const out: RenewResult = { renewed: 0, failed: 0, pending: false };
  for (const row of due) {
    if (clock().getTime() - started > opts.budgetMs) return { ...out, pending: true };
    try {
      const r = await renewOne(db, row.publication.product.accountId, row.publicationId, clock());
      if (r === 'renewed') out.renewed++;
      else if (r === 'failed') out.failed++;
    } catch (e) {
      console.error('No se pudo renovar el descuento', row.publicationId, e instanceof Error ? e.message : e);
      // Demasiados pedidos: se sigue en la próxima pasada.
      if (e instanceof ConnectError && e.busy) return { ...out, pending: true };
    }
  }
  return out;
}

async function renewOne(db: Db, accountId: string, publicationId: string, now: Date): Promise<'renewed' | 'failed' | 'skipped'> {
  const p = await loadForPush(db, accountId, publicationId);
  const copy = p.channelCopy;
  const publisher = getChannelPublisher(p.store.channel.kind);
  if (!copy?.discountUntil || copy.missingSince || !p.externalId || !publisher) return 'skipped';
  const app = faceValues(p);
  const channel = channelFaceValues(copy);
  const appPrints = fingerprintsOf(app);
  const pct = Number(app.discount);
  // La app ya no tiene descuento: no hay nada que renovar.
  if (!(pct > 0)) {
    await db.channelCopy.update({ where: { publicationId }, data: { discountUntil: null, discountSentAt: null } });
    return 'skipped';
  }
  // Se renueva el mismo que se subió. Si en la app se cambió después, o
  // también cambió en el canal, lo decide la persona desde Por subir.
  if (faceSummary(appPrints, copy).choose.includes('discount')) return 'skipped';
  const last = await db.channelSyncChange.findFirst({
    where: { publicationId, field: 'discount', kind: { in: ['SENT', 'RENEWED'] } },
    orderBy: { createdAt: 'desc' },
    select: { after: true },
  });
  if (discountText(typeof last?.after === 'string' ? last.after : null) !== app.discount) return 'skipped';
  const rejections = parseRejections(copy.rejections);
  if (rejections.discount?.fingerprint === appPrints.discount) return 'skipped';

  const listPrice = Number(channel.price ?? 0);
  let until: Date | null;
  try {
    until = await setDiscounts(db, p, publisher, { pct, listPrice }, now);
  } catch (e) {
    if (!(e instanceof PublishError)) throw e;
    rejections.discount = { message: e.message, at: now.toISOString(), fingerprint: appPrints.discount };
    await db.$transaction([
      db.channelCopy.update({ where: { publicationId }, data: { rejections } }),
      db.channelSyncChange.create({
        data: { publicationId, field: 'discount', kind: 'REJECTED', before: asJson(channel.discount), after: asJson(app.discount), message: `${RENEWAL_FAILED}${e.message}` },
      }),
    ]);
    return 'failed';
  }
  await db.$transaction(async (tx) => {
    const current = await tx.channelCopy.findUniqueOrThrow({ where: { publicationId }, select: { fingerprints: true, agreed: true, rejections: true } });
    const left = parseRejections(current.rejections);
    delete left.discount;
    await tx.channelCopy.update({
      where: { publicationId },
      data: {
        discount: app.discount,
        ...discountDates(pct, until, now),
        fingerprints: { ...parseFingerprints(current.fingerprints), discount: appPrints.discount },
        agreed: { ...parseFingerprints(current.agreed), discount: appPrints.discount },
        rejections: left,
      },
    });
    await tx.channelSyncChange.create({
      data: { publicationId, field: 'discount', kind: 'RENEWED', before: asJson(channel.discount), after: asJson(app.discount) },
    });
  });
  return 'renewed';
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

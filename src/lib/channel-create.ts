import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { ConnectError } from '@/channels/connect';
import { getChannelPublisher, PublishError, type ChannelAttributeUpdate, type ChannelNewVariant } from '@/channels/publish';
import { mergeCatalogAttributes, normalizeText } from '@/domain/catalog-data';
import { faceValues, fingerprint, fingerprintsOf, priceText } from '@/domain/channel-sync';
import { channelPhotos, measureText, parseMedia, variantKey, type PhotoRef } from '@/domain/media';
import { parseNameValueList } from '@/domain/name-value';
import { checkTitle } from '@/domain/titles';
import { loadCatalogData } from '@/lib/catalog-data';
import { readOne } from '@/lib/channel-sync';
import { withAccessToken } from '@/lib/connections';
import { measuresOf, photosPerMeasure, picturesFor, type Measure } from '@/lib/media';
import { loadTitleRules } from '@/lib/title-rules';

// Crear en el canal una publicación que todavía no está publicada, con lo que
// tiene la app: título, descripción, categoría, datos de catálogo, fotos y la
// ficha. El precio, la cantidad y el tipo de publicación los pide el canal y se
// cargan al crearla; después se manejan allá. Si la ficha tiene varias medidas,
// se crea una sola publicación con todas: comparten el precio y cada una lleva
// su SKU, su cantidad y sus fotos. Antes de crear se revisa todo y se dice qué
// falta. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class CreateError extends Error {}

export type CreateCheck = { label: string; ok: boolean; detail: string; blocking: boolean };

const names = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`);

/** "6 meses", "90 días" o "1 año": la garantía, si la ficha la tiene en esa forma. */
export function warrantyText(raw: string | null): string | null {
  const m = (raw ?? '').trim().match(/^(\d{1,3})\s*(d[ií]as?|mes(?:es)?|años?)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase().startsWith('d') ? (n === 1 ? 'día' : 'días') : m[2].toLowerCase().startsWith('m') ? (n === 1 ? 'mes' : 'meses') : n === 1 ? 'año' : 'años';
  return `${n} ${unit}`;
}

/** Si las medidas se pueden crear juntas: cada una con su medida cargada, sin repetir, y con fotos. */
function measuresCheck(measures: Measure[], media: PhotoRef[]): CreateCheck {
  if (measures.length < 2) return { label: 'Medidas', ok: true, detail: 'Una sola.', blocking: true };
  const unnamed = measures.filter((m) => !measureText(m.measure)).map((m) => m.label);
  const named = measures.filter((m) => measureText(m.measure));
  const repeated = named.filter((m, i) => named.findIndex((x) => measureText(x.measure) === measureText(m.measure)) !== i).map((m) => m.label);
  const empty = media.length > 0 ? photosPerMeasure(media, measures).filter((x) => x.count === 0).map((x) => x.measure.label) : [];
  const problems = [
    ...(unnamed.length > 0 ? [`Cargá en la ficha la medida de ${names(unnamed)}, es lo que elige el comprador.`] : []),
    ...(repeated.length > 0 ? [`${names([...new Set(repeated)])} está más de una vez en la ficha.`] : []),
    ...(empty.length > 0
      ? [`${empty.length === 1 ? 'La medida' : 'Las medidas'} ${names(empty)} no ${empty.length === 1 ? 'tiene' : 'tienen'} fotos, elegilas en Organización de multimedia.`]
      : []),
  ];
  return {
    label: 'Medidas',
    ok: problems.length === 0,
    detail:
      problems.length > 0
        ? problems.join(' ')
        : `${names(measures.map((m) => m.label))}, en la misma publicación. Comparten el precio y cada una lleva su SKU, su cantidad y sus fotos.`,
    blocking: true,
  };
}

async function load(db: Db, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      title: true,
      description: true,
      attributes: true,
      media: true,
      externalId: true,
      price: true,
      installments: true,
      discount: true,
      currency: true,
      product: { select: { id: true, warranty: true, variants: { select: { sku: true, measure: true }, orderBy: { position: 'asc' } } } },
      store: { select: { id: true, channel: { select: { id: true, kind: true, name: true } }, connection: { select: { status: true } } } },
    },
  });
  if (!p) throw new CreateError('La publicación no está en la cuenta.');
  return p;
}

/** Qué está listo y qué falta para crear la publicación en el canal. */
export async function createChecks(db: Db, args: { accountId: string; publicationId: string }) {
  const p = await load(db, args.accountId, args.publicationId);
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  const publisher = getChannelPublisher(p.store.channel.kind);
  const blocked = p.externalId
    ? `Ya está publicada en ${channelName}.`
    : !publisher
      ? `Todavía no se pueden crear publicaciones en ${channelName} desde la app.`
      : p.store.connection?.status !== 'ACTIVE'
        ? `La tienda no está conectada con ${channelName}: conectala en Conexión.`
        : null;

  const checks: CreateCheck[] = [];
  const title = p.title?.trim() ?? '';
  const { rules } = await loadTitleRules(db, args.accountId, p.store.channel);
  const titleCheck = title ? checkTitle(title, rules) : null;
  checks.push({
    label: 'Título',
    ok: Boolean(titleCheck && titleCheck.errors.length === 0),
    detail: !titleCheck ? 'Falta el título.' : titleCheck.errors.length > 0 ? titleCheck.errors.join(' ') : `${titleCheck.length} caracteres.`,
    blocking: true,
  });

  const catalog = await loadCatalogData(db, p.id);
  const category = catalog?.category ?? null;
  checks.push({
    label: 'Categoría',
    ok: category !== null,
    detail: category ? category.name : 'Elegila en Datos de catálogo, en el paso Información o en la página de la publicación.',
    blocking: true,
  });
  const missing = [
    ...(catalog?.fromProduct.filter((f) => f.field.required && !f.value).map((f) => `${f.field.label} (de la ficha)`) ?? []),
    ...(catalog?.fields.filter((f) => f.required && !catalog.values[f.id] && !catalog.fromStore[f.id]).map((f) => f.label) ?? []),
  ];
  // Los que la publicación no tiene y van como en la mayoría de la tienda, por ejemplo los impuestos.
  const fromStore = (catalog?.fields ?? []).flatMap((f) => (!catalog!.values[f.id] && catalog!.fromStore[f.id] ? [`${f.label} ${catalog!.fromStore[f.id].value}`] : []));
  if (category) {
    checks.push({
      label: 'Datos obligatorios',
      ok: missing.length === 0,
      detail: [
        missing.length === 0 ? 'Están todos.' : `Faltan ${names(missing)}.`,
        ...(fromStore.length > 0 ? [`${names(fromStore)} van como en la mayoría de las publicaciones de la tienda; se cambian en Datos de catálogo.`] : []),
      ].join(' '),
      blocking: true,
    });
  }

  const media = parseMedia(p.media) ?? [];
  checks.push({
    label: 'Fotos',
    ok: media.length > 0,
    detail: media.length > 0 ? `${media.length === 1 ? '1 foto' : `${media.length} fotos`}.` : 'Elegilas en Organización de multimedia.',
    blocking: true,
  });

  const measures = measuresOf(p.product.variants);
  checks.push(measuresCheck(measures, media));

  checks.push({
    label: 'Descripción',
    ok: Boolean(p.description?.trim()),
    detail: p.description?.trim() ? `${p.description.trim().length} caracteres.` : 'Sin descripción: se puede crear igual y subirla después.',
    blocking: false,
  });
  const warranty = warrantyText(p.product.warranty);
  checks.push({
    label: 'Garantía',
    ok: warranty !== null,
    detail: warranty ?? (p.product.warranty ? `«${p.product.warranty}» no tiene la forma «6 meses»: se crea sin garantía.` : 'La ficha no tiene garantía: se crea sin garantía.'),
    blocking: false,
  });

  return {
    channelName,
    blocked,
    checks,
    ready: !blocked && checks.every((c) => c.ok || !c.blocking),
    listingTypes: publisher?.listingTypes ?? [],
    price: p.price === null ? null : Number(p.price),
    // Con varias medidas, la cantidad se carga en cada una.
    measures: measures.length >= 2 ? measures.map((m) => ({ key: m.key, label: m.label })) : [],
  };
}

export type CreateInfo = Awaited<ReturnType<typeof createChecks>>;

type CreateArgs = {
  accountId: string;
  publicationId: string;
  price: number;
  // Sin medidas, la cantidad de la publicación; con medidas, la de cada una por su clave.
  quantity?: number;
  quantities?: Record<string, number>;
  listingType: string;
  userId: string | null;
  now?: Date;
};
type Created = { externalId: string; url: string | null; warnings: string[]; confirmed: boolean };

/**
 * Crea la publicación en el canal. Devuelve su código y lo que quedó a medias.
 * Si no se pudo, el intento queda en el historial con el motivo.
 */
export async function createInChannel(db: Db, args: CreateArgs): Promise<Created> {
  // Antes de anotar nada: que la publicación sea de la cuenta.
  const info = await createChecks(db, args);
  try {
    return await create(db, args, info);
  } catch (e) {
    if (e instanceof CreateError || e instanceof ConnectError) {
      await db.channelSyncChange
        .create({ data: { publicationId: args.publicationId, field: 'publication', kind: 'CREATE_FAILED', message: e.message, userId: args.userId } })
        .catch((err) => console.error('No se pudo anotar el intento', err instanceof Error ? err.message : err));
    }
    throw e;
  }
}

async function create(db: Db, args: CreateArgs, info: CreateInfo): Promise<Created> {
  const now = args.now ?? new Date();
  if (info.blocked) throw new CreateError(info.blocked);
  const failing = info.checks.filter((c) => c.blocking && !c.ok);
  if (failing.length > 0) throw new CreateError(`Todavía no se puede crear: ${failing.map((c) => `${c.label}: ${c.detail}`).join(' ')}`);
  if (!(args.price > 0)) throw new CreateError('Cargá el precio.');
  const quantityOk = (n: number | undefined): n is number => n !== undefined && Number.isInteger(n) && n >= 1;
  if (info.measures.length === 0 && !quantityOk(args.quantity)) throw new CreateError('La cantidad tiene que ser 1 o más.');
  const short = info.measures.filter((m) => !quantityOk(args.quantities?.[m.key])).map((m) => m.label);
  if (short.length > 0) throw new CreateError(`La cantidad de ${names(short)} tiene que ser 1 o más.`);
  if (!info.listingTypes.some((t) => t.value === args.listingType)) throw new CreateError('Elegí el tipo de publicación.');

  const p = await load(db, args.accountId, args.publicationId);
  const publisher = getChannelPublisher(p.store.channel.kind)!;
  const catalog = (await loadCatalogData(db, p.id))!;
  const category = catalog.category!;

  // Los datos de catálogo de la categoría y los que salen de la ficha, con el código de cada campo.
  // Lo que la publicación no tiene y suele ser igual en toda la tienda va como en la mayoría, y queda en la publicación.
  const fromStore = Object.fromEntries(catalog.fields.flatMap((f) => (!catalog.values[f.id] && catalog.fromStore[f.id] ? [[f.id, catalog.fromStore[f.id].value]] : [])));
  const values: Record<string, string> = { ...catalog.values, ...fromStore };
  const attributes: ChannelAttributeUpdate[] = [
    ...catalog.fromProduct.filter((f) => f.value).map((f) => ({ id: f.field.id, value: f.value!, multiple: false })),
    ...catalog.fields.filter((f) => values[f.id]).map((f) => ({ id: f.id, value: values[f.id], multiple: Boolean(f.multiple) })),
  ];
  const ownAttributes = Object.keys(fromStore).length > 0 ? mergeCatalogAttributes(parseNameValueList(p.attributes), catalog.fields, fromStore) : null;
  const app = faceValues(ownAttributes ? { ...p, attributes: ownAttributes } : p);
  const known = new Set(catalog.fields.map((f) => normalizeText(f.label)));
  const left = app.attributes.filter((a) => !known.has(normalizeText(a.name))).map((a) => `«${a.name}»`);
  const warnings: string[] = left.length > 0 ? [`No se mandaron ${names(left)}: no son campos de la categoría.`] : [];

  const media = parseMedia(p.media) ?? [];
  const { pictures, origins, problems, layout } = await picturesFor(db, p.product.id, media);
  if (problems.length > 0 || pictures.length === 0) throw new CreateError(problems.join(' ') || 'Elegí las fotos en Organización de multimedia.');
  const variant = p.product.variants.find((v) => v.sku);
  // Cada medida con su cantidad y las fotos que ve el comprador en ella.
  const variants: ChannelNewVariant[] =
    info.measures.length >= 2
      ? measuresOf(p.product.variants).map((m) => ({
          sku: m.sku,
          measure: m.measure!,
          quantity: args.quantities![m.key],
          pictures: layout.variants.find((v) => variantKey(v) === m.key)?.pictures ?? layout.general,
        }))
      : [];

  let created;
  try {
    created = await withAccessToken(db, p.store.id, (token) =>
      publisher.create(token, {
        title: p.title!.trim(),
        categoryId: category.id,
        price: args.price,
        currency: p.currency,
        quantity: args.quantity ?? 0,
        listingType: args.listingType,
        description: p.description?.trim() || null,
        attributes,
        pictures,
        sku: variant?.sku ?? null,
        warranty: warrantyText(p.product.warranty),
        variants,
      }),
    );
  } catch (e) {
    if (e instanceof PublishError) throw new CreateError(e.message);
    throw e;
  }
  warnings.push(...created.warnings);
  const family = created.variations.flatMap((v) => (v.externalId ? [{ ...v, externalId: v.externalId }] : []));
  const descriptionSent = Boolean(app.description?.trim()) && created.warnings.length === 0;

  // La cara del canal, con lo que se mandó: la lectura de confirmación trae lo que guardó el canal.
  const ids = created.pictureIds && created.pictureIds.length === pictures.length ? created.pictureIds : [];
  const sentAttributes = [
    ...catalog.fields.filter((f) => values[f.id]).map((f) => ({ name: f.label, value: values[f.id] })),
  ];
  const channelPrints = {
    ...fingerprintsOf({ ...app, description: descriptionSent ? app.description : null, attributes: sentAttributes, photos: null }),
    photos: fingerprint('photos', channelPhotos(ids.map(() => ''), ids, created.variations)),
    price: fingerprint('price', priceText(args.price)),
    // Las cuotas y el descuento salen de la lectura de confirmación: si la app tiene otros, quedan para subir.
    installments: fingerprint('installments', null),
    discount: fingerprint('discount', null),
  };
  await db.$transaction(async (tx) => {
    await tx.publication.update({
      where: { id: p.id },
      data: {
        externalId: created.externalId,
        url: created.url,
        channelStatus: 'ACTIVE',
        price: args.price,
        media: Prisma.DbNull,
        ...(ownAttributes ? { attributes: ownAttributes } : {}),
        // Si el canal guardó cada medida como una publicación aparte, la app las sigue juntas.
        variantListings: family.map((v) => ({ externalId: v.externalId, sku: v.sku, measure: v.measure })),
      },
    });
    const copy = {
      readAt: now,
      title: app.title,
      description: descriptionSent ? app.description : null,
      attributes: sentAttributes,
      price: args.price,
      status: 'ACTIVE' as const,
      url: created.url,
      photos: ids.map(() => ''),
      photoIds: ids,
      variations: created.variations,
      photoOrigins: Object.fromEntries(ids.flatMap((id, i) => (origins[i] ? [[id, origins[i]]] : []))),
      categoryId: category.id,
      attributeIds: Object.fromEntries(
        catalog.fields.map((f) => [normalizeText(f.label), { id: f.id, multiple: Boolean(f.multiple) }]),
      ),
      fingerprints: channelPrints,
      agreed: channelPrints,
    };
    await tx.channelCopy.upsert({ where: { publicationId: p.id }, create: { publicationId: p.id, ...copy }, update: copy });
    await tx.channelSyncChange.create({
      data: { publicationId: p.id, field: 'publication', kind: 'CREATED', after: { externalId: created.externalId }, userId: args.userId },
    });
    await tx.channelApplication.create({
      data: {
        publicationId: p.id,
        method: 'API',
        appliedAt: now,
        fields: ['title', ...(descriptionSent ? ['description'] : []), 'attributes', 'photos', 'price'],
        createdById: args.userId,
      },
    });
  });

  let confirmed = false;
  try {
    const taken = await readOne(db, { accountId: args.accountId, publicationId: p.id });
    confirmed = taken !== null;
    // Hay canales que arman su propio título: la app se queda con ese.
    if (taken?.includes('title')) {
      const now = await db.publication.findUnique({ where: { id: p.id }, select: { title: true } });
      warnings.push(`${info.channelName} armó su propio título: «${now?.title ?? ''}». Quedó así en la app.`);
    }
  } catch (e) {
    console.error('No se pudo leer la publicación recién creada', e instanceof Error ? e.message : e);
  }
  return { externalId: created.externalId, url: created.url, warnings, confirmed };
}

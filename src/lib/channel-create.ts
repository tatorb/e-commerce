import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { ConnectError } from '@/channels/connect';
import { getChannelPublisher, PublishError, type ChannelAttributeUpdate, type ChannelPicture } from '@/channels/publish';
import { mergeCatalogAttributes, normalizeText } from '@/domain/catalog-data';
import { faceValues, fingerprint, fingerprintsOf, priceText } from '@/domain/channel-sync';
import { writeToFamily } from '@/domain/family-members';
import { channelPhotos, measureText, parseMedia, type PhotoRef } from '@/domain/media';
import { parseNameValueList } from '@/domain/name-value';
import { checkTitle } from '@/domain/titles';
import { loadCatalogData } from '@/lib/catalog-data';
import { readOne } from '@/lib/channel-sync';
import { withAccessToken } from '@/lib/connections';
import { familyByMeasure, fillFamilyCode } from '@/lib/families';
import { measuresOf, picturesFor, soleMeasurePhotos, type Measure } from '@/lib/media';
import { available, isManaged } from '@/domain/stock';
import { SOURCE_SELECT, sourceOf } from '@/lib/stock-plan';
import { loadTitleRules } from '@/lib/title-rules';

// Crear en el canal una publicación que todavía no está publicada, con lo que
// tiene la app: título, descripción, categoría, datos de catálogo, fotos y la
// ficha. El precio, la cantidad y el tipo de publicación los pide el canal y se
// cargan al crearla; después se manejan allá. Si la ficha tiene varias medidas,
// se crea una publicación por medida, todas en la misma familia: comparten el
// título y el precio, salvo la que tiene el suyo, y cada una lleva su SKU, su
// cantidad y sus fotos. Antes de crear se revisa todo y se dice qué falta.
// Recibe la base por parámetro para poder probarlo.

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

const fotos = (n: number) => (n === 1 ? '1 foto' : `${n} fotos`);

/**
 * Una publicación para crear: la única, o la de una medida de la familia. Sin
 * id todavía no está en la app: se arma al crear, con lo de la principal.
 */
type Target = {
  id: string | null;
  key: string;
  label: string;
  sku: string | null;
  measure: string | null;
  // El suyo, si no lleva el de la familia.
  ownPrice: number | null;
  media: PhotoRef[];
};

const MEMBER_SELECT = { id: true, externalId: true, variantKey: true, price: true, ownPrice: true, media: true } as const;

async function load(db: Db, accountId: string, publicationId: string) {
  const asked = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: { id: true, family: { select: { leadId: true } } },
  });
  if (!asked) throw new CreateError('La publicación no está en la cuenta.');
  // En una familia, lo compartido sale de la principal.
  return db.publication.findUniqueOrThrow({
    where: { id: asked.family?.leadId ?? asked.id },
    select: {
      id: true,
      title: true,
      description: true,
      attributes: true,
      media: true,
      externalId: true,
      variantKey: true,
      price: true,
      installments: true,
      discount: true,
      quantities: true,
      currency: true,
      familyId: true,
      family: { select: { members: { select: MEMBER_SELECT, orderBy: { createdAt: 'asc' } } } },
      product: { select: { id: true, warranty: true, variants: { select: { sku: true, measure: true }, orderBy: { position: 'asc' } } } },
      store: { select: { id: true, channel: { select: { id: true, kind: true, name: true } }, connection: { select: { status: true } } } },
    },
  });
}

type Loaded = Awaited<ReturnType<typeof load>>;

/**
 * Lo que falta crear y las que ya están publicadas. Con varias medidas, una por
 * medida: las de la familia sin publicar y, si la familia no tiene nada
 * publicado, las medidas de la ficha que todavía no tienen la suya.
 */
function targetsOf(p: Loaded): { byMeasure: boolean; targets: Target[]; published: { label: string; externalId: string }[]; unknown: number } {
  const measures = measuresOf(p.product.variants);
  const media = parseMedia(p.media) ?? [];
  if (!p.family && measures.length < 2) {
    const sku = p.product.variants.find((v) => v.sku)?.sku ?? null;
    return {
      byMeasure: false,
      targets: p.externalId ? [] : [{ id: p.id, key: '', label: '', sku, measure: null, ownPrice: null, media }],
      published: [],
      unknown: 0,
    };
  }
  const members = p.family?.members ?? [{ id: p.id, externalId: p.externalId, variantKey: p.variantKey, price: p.price, ownPrice: false, media: p.media }];
  const measureOf = (key: string | null) => measures.find((m) => m.key === key) ?? null;
  // Sin familia, la publicación vende su medida elegida o la primera.
  const own = (m: (typeof members)[number]) => measureOf(m.variantKey) ?? (p.family ? null : measures[0]);
  const published = members.flatMap((m) => (m.externalId ? [{ label: own(m)?.label ?? 'Sin medida', externalId: m.externalId }] : []));
  const targets: Target[] = members
    .filter((m) => !m.externalId)
    .map((m) => {
      const measure = own(m);
      const photos = parseMedia(m.media) ?? [];
      return {
        id: m.id,
        key: measure?.key ?? `id:${m.id}`,
        label: measure?.label ?? 'Sin medida',
        sku: measure?.sku ?? null,
        measure: measure?.measure ?? null,
        ownPrice: m.ownPrice && m.price !== null ? Number(m.price) : null,
        media: p.family || !measure ? photos : soleMeasurePhotos(photos, measures, measure),
      };
    });
  if (published.length === 0) {
    for (const m of measures) {
      if (targets.some((t) => t.key === m.key)) continue;
      targets.push({ id: null, key: m.key, label: m.label, sku: m.sku, measure: m.measure, ownPrice: null, media: soleMeasurePhotos(media, measures, m) });
    }
  }
  const order = (t: Target) => {
    const i = measures.findIndex((m) => m.key === t.key);
    return i < 0 ? measures.length : i;
  };
  targets.sort((a, b) => order(a) - order(b));
  return { byMeasure: true, targets, published, unknown: targets.filter((t) => t.key.startsWith('id:')).length };
}

/** Si las medidas se pueden crear: cada una con su medida cargada, sin repetir, y con fotos. */
function measuresCheck(measures: Measure[], targets: Target[], published: { label: string }[], unknown: number): CreateCheck {
  const unnamed = measures.filter((m) => !measureText(m.measure)).map((m) => m.label);
  const named = measures.filter((m) => measureText(m.measure));
  const repeated = named.filter((m, i) => named.findIndex((x) => measureText(x.measure) === measureText(m.measure)) !== i).map((m) => m.label);
  const problems = [
    ...(unnamed.length > 0 ? [`Cargá en la ficha la medida de ${names(unnamed)}, es lo que elige el comprador.`] : []),
    ...(repeated.length > 0 ? [`${names([...new Set(repeated)])} está más de una vez en la ficha.`] : []),
    ...(unknown > 0 ? [`${unknown === 1 ? 'Una publicación vende una medida que' : `${unknown} publicaciones venden medidas que`} ya no está en la ficha.`] : []),
  ];
  const labels = names(targets.map((t) => t.label));
  return {
    label: 'Medidas',
    ok: problems.length === 0,
    detail:
      problems.length > 0
        ? problems.join(' ')
        : published.length > 0
          ? `Falta crear ${labels}, en la familia de ${names(published.map((x) => x.label))}, que ya ${published.length === 1 ? 'está publicada' : 'están publicadas'}.`
          : `${labels}, una publicación por medida, en la misma familia. Cada una lleva su SKU, su cantidad y sus fotos.`,
    blocking: true,
  };
}

/** Qué está listo y qué falta para crear la publicación en el canal. Con varias medidas, una por medida. */
export async function createChecks(db: Db, args: { accountId: string; publicationId: string }) {
  const p = await load(db, args.accountId, args.publicationId);
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  const publisher = getChannelPublisher(p.store.channel.kind);
  const { byMeasure, targets, published, unknown } = targetsOf(p);
  const blocked =
    targets.length === 0
      ? p.family
        ? `Todas las medidas ya están publicadas en ${channelName}.`
        : `Ya está publicada en ${channelName}.`
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

  const empty = targets.filter((t) => t.media.length === 0).map((t) => t.label);
  checks.push({
    label: 'Fotos',
    ok: targets.length > 0 && empty.length === 0,
    detail: !byMeasure
      ? targets[0]?.media.length
        ? `${fotos(targets[0].media.length)}.`
        : 'Elegilas en Organización de multimedia.'
      : empty.length > 0
        ? `${empty.length === 1 ? 'La medida' : 'Las medidas'} ${names(empty)} no ${empty.length === 1 ? 'tiene' : 'tienen'} fotos, elegilas en Organización de multimedia.`
        : `${names(targets.map((t) => `${t.label} con ${fotos(t.media.length)}`))}.`,
    blocking: true,
  });

  const measures = measuresOf(p.product.variants);
  checks.push(byMeasure ? measuresCheck(measures, targets, published, unknown) : { label: 'Medidas', ok: true, detail: 'Una sola.', blocking: true });

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

  // Si el producto lleva stock en la app, la cantidad para empezar sale de ahí.
  const product = await db.product.findUnique({ where: { id: p.product.id }, select: SOURCE_SELECT });
  const source = product ? sourceOf(product) : null;
  const stock =
    source && isManaged(source)
      ? {
          quantity: available(source, null),
          quantities: Object.fromEntries(targets.map((t) => [t.key, available(source, { sku: t.sku, measure: t.measure })])),
        }
      : null;

  return {
    channelName,
    blocked,
    checks,
    ready: !blocked && checks.every((c) => c.ok || !c.blocking),
    listingTypes: publisher?.listingTypes ?? [],
    price: p.price === null ? null : Number(p.price),
    // Con varias medidas, la cantidad se carga en cada una; el precio es el de la familia, salvo la que tiene el suyo.
    measures: byMeasure ? targets.map((t) => ({ key: t.key, label: t.label, price: t.ownPrice })) : [],
    // Las medidas de la familia que ya están publicadas.
    published,
    stock,
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
type Created = {
  // La primera que se creó.
  externalId: string;
  url: string | null;
  warnings: string[];
  confirmed: boolean;
  // Con medidas, cada una con su código.
  created: { label: string; externalId: string }[];
};

/**
 * Crea la publicación en el canal, o la de cada medida. Devuelve los códigos y
 * lo que quedó a medias. Si no se pudo, el intento queda en el historial con
 * el motivo.
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

/** La misma foto en varias medidas se manda una sola vez. */
function pictureKey(picture: ChannelPicture, origin: string | null): string {
  if (picture.kind === 'existing') return `canal:${picture.id}`;
  if (picture.kind === 'link') return `link:${picture.url}`;
  return origin ? `corregida:${origin}` : `archivo:${picture.name}:${picture.data.length}`;
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

  let p = await load(db, args.accountId, args.publicationId);
  // Las medidas que todavía no tienen su publicación en la app se arman ahora, en su familia.
  if (targetsOf(p).targets.some((t) => t.id === null)) {
    await db.$transaction((tx) => familyByMeasure(tx, { publicationId: p.id, userId: args.userId, now }));
    p = await load(db, args.accountId, args.publicationId);
  }
  const { byMeasure, targets } = targetsOf(p);
  if (targets.some((t) => t.id === null) || (byMeasure && targets.some((t) => !info.measures.some((m) => m.key === t.key)))) {
    throw new CreateError('Las medidas cambiaron mientras tanto. Recargá la página.');
  }
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

  // Las fotos de todas en una sola lista, y las de cada una por su lugar en la lista.
  const pictures: ChannelPicture[] = [];
  const origins: (string | null)[] = [];
  const at = new Map<string, number>();
  const own: number[][] = [];
  for (const t of targets) {
    const sent = await picturesFor(db, p.product.id, t.media, null, byMeasure ? t.key : p.variantKey);
    if (sent.problems.length > 0 || sent.pictures.length === 0) {
      throw new CreateError(sent.problems.join(' ') || `Elegí las fotos${byMeasure ? ` de ${t.label}` : ''} en Organización de multimedia.`);
    }
    own.push(
      sent.pictures.map((picture, i) => {
        const key = pictureKey(picture, sent.origins[i]);
        if (!at.has(key)) {
          at.set(key, pictures.length);
          pictures.push(picture);
          origins.push(sent.origins[i]);
        }
        return at.get(key)!;
      }),
    );
  }
  const priceOf = (t: Target) => t.ownPrice ?? args.price;

  let created;
  try {
    created = await withAccessToken(db, p.store.id, (token) =>
      publisher.create(token, {
        title: p.title!.trim(),
        categoryId: category.id,
        currency: p.currency,
        listingType: args.listingType,
        description: p.description?.trim() || null,
        attributes,
        pictures,
        warranty: warrantyText(p.product.warranty),
        members: targets.map((t, i) => ({
          sku: t.sku,
          measure: t.measure,
          price: priceOf(t),
          quantity: byMeasure ? args.quantities![t.key] : args.quantity!,
          pictures: own[i],
        })),
      }),
    );
  } catch (e) {
    if (e instanceof PublishError) throw new CreateError(e.message);
    throw e;
  }
  warnings.push(...created.warnings);
  const descriptionSent = Boolean(app.description?.trim()) && created.warnings.length === 0;
  const sentAttributes = catalog.fields.filter((f) => values[f.id]).map((f) => ({ name: f.label, value: values[f.id] }));
  const done = targets.flatMap((t, i) => (created.members[i] ? [{ t, i, c: created.members[i]! }] : []));
  if (done.length === 0) throw new CreateError(warnings.join(' ') || `${info.channelName} no creó ninguna.`);

  await db.$transaction(async (tx) => {
    // El precio de la familia queda en las que no tienen el suyo, y los datos que se tomaron de la tienda, en todas.
    await tx.publication.updateMany({ where: { id: { in: targets.filter((t) => t.ownPrice === null).map((t) => t.id!) } }, data: { price: args.price } });
    if (ownAttributes) await writeToFamily(tx, p.id, { attributes: ownAttributes });
    for (const { t, i, c } of done) {
      // La cara del canal, con lo que se mandó: la lectura de confirmación trae lo que guardó el canal.
      const ids = c.pictureIds && c.pictureIds.length === own[i].length ? c.pictureIds : [];
      const channelPrints = {
        ...fingerprintsOf({ ...app, description: descriptionSent ? app.description : null, attributes: sentAttributes, photos: null }),
        photos: fingerprint('photos', channelPhotos(ids.map(() => ''), ids, [])),
        price: fingerprint('price', priceText(priceOf(t))),
        // Las cuotas y el descuento salen de la lectura de confirmación: si la app tiene otros, quedan para subir.
        installments: fingerprint('installments', null),
        discount: fingerprint('discount', null),
        // La cantidad también: hasta leerla, la app sigue a la del canal.
        quantity: fingerprint('quantity', []),
      };
      await tx.publication.update({
        where: { id: t.id! },
        data: { externalId: c.externalId, url: c.url, channelStatus: 'ACTIVE', price: priceOf(t), media: Prisma.DbNull },
      });
      const copy = {
        readAt: now,
        title: app.title,
        description: descriptionSent ? app.description : null,
        attributes: sentAttributes,
        price: priceOf(t),
        status: 'ACTIVE' as const,
        url: c.url,
        photos: ids.map(() => ''),
        photoIds: ids,
        variations: [],
        photoOrigins: Object.fromEntries(ids.flatMap((id, k) => (origins[own[i][k]] ? [[id, origins[own[i][k]]]] : []))),
        categoryId: category.id,
        attributeIds: Object.fromEntries(catalog.fields.map((f) => [normalizeText(f.label), { id: f.id, multiple: Boolean(f.multiple) }])),
        fingerprints: channelPrints,
        agreed: channelPrints,
      };
      await tx.channelCopy.upsert({ where: { publicationId: t.id! }, create: { publicationId: t.id!, ...copy }, update: copy });
      await tx.channelSyncChange.create({
        data: { publicationId: t.id!, field: 'publication', kind: 'CREATED', after: { externalId: c.externalId }, userId: args.userId },
      });
      await tx.channelApplication.create({
        data: {
          publicationId: t.id!,
          method: 'API',
          appliedAt: now,
          fields: ['title', ...(descriptionSent ? ['description'] : []), 'attributes', 'photos', 'price'],
          createdById: args.userId,
        },
      });
    }
    // Las que no se crearon quedan sin publicar, con el motivo en su historial.
    for (const t of targets.filter((_, i) => !created.members[i])) {
      await tx.channelSyncChange.create({
        data: { publicationId: t.id!, field: 'publication', kind: 'CREATE_FAILED', message: `${t.label} no se creó.`, userId: args.userId },
      });
    }
  });

  let confirmed = true;
  for (const { t } of done) {
    try {
      const taken = await readOne(db, { accountId: args.accountId, publicationId: t.id! });
      if (taken === null) confirmed = false;
      // Hay canales que arman su propio título: la app se queda con ese.
      if (taken?.includes('title')) {
        const now = await db.publication.findUnique({ where: { id: t.id! }, select: { title: true } });
        warnings.push(`${info.channelName} armó su propio título: «${now?.title ?? ''}». Quedó así en la app.`);
      }
    } catch (e) {
      confirmed = false;
      console.error('No se pudo leer la publicación recién creada', e instanceof Error ? e.message : e);
    }
  }
  // La familia toma el código que le dio el canal, si lo leyó.
  if (p.familyId) await fillFamilyCode(db, p.familyId).catch((e) => console.error('No se pudo guardar el código de la familia', e instanceof Error ? e.message : e));
  const first = done[0].c;
  return {
    externalId: first.externalId,
    url: first.url,
    warnings: [...new Set(warnings)],
    confirmed,
    created: byMeasure ? done.map(({ t, c }) => ({ label: t.label, externalId: c.externalId })) : [],
  };
}

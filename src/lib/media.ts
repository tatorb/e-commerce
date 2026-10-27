import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import type { ChannelPicture, ChannelPictureLayout } from '@/channels/publish';
import {
  asIsProblem,
  channelPhotos,
  cleanMedia,
  parseMedia,
  parseVariations,
  parseVideoVariants,
  photoKey,
  photoVariants,
  variantKey,
  variantPhotos,
  withMarks,
  type PhotoRef,
  type VariantLike,
} from '@/domain/media';
import { LAST_PHOTO_STEP } from '@/domain/photo-steps';
import { copyChannelProduct, copySkus } from '@/domain/stock';
import { checkClip } from '@/domain/videos';
import type { PublicationMeasures } from '@/domain/shoot';
import { BY_BROWSER, setClips } from '@/lib/videos';
import { photoFileHref } from '@/lib/photo-rules';
import { readStored } from '@/lib/stored-files';

// Las fotos de una publicación: de dónde se pueden tomar (las que ya están en
// el canal, las del paso Imágenes, corregidas o tal cual, y las del producto) y cuáles
// quedaron elegidas, en orden. Si el producto tiene varias medidas, también de
// cuáles es cada foto y cada video. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

export class MediaError extends Error {}

export type MediaItem = {
  ref: PhotoRef;
  key: string;
  // Cómo se ve: el link de la foto, o la vista liviana de la corregida.
  thumb: string | null;
  // La foto más grande, para la lupa. Sin esto, la misma de la vista.
  zoom?: string | null;
  label: string;
  note: string | null;
  // Por qué no se puede elegir para este canal, por ejemplo un original que no acepta tal cual.
  blocked?: string;
};

/** Una medida de la ficha, como se marca en las fotos. */
export type Measure = { key: string; label: string; sku: string | null; measure: string | null };

/** Las medidas de la ficha que se pueden marcar: las que tienen SKU o medida, sin repetir. */
export function measuresOf(variants: VariantLike[]): Measure[] {
  const out: Measure[] = [];
  for (const v of variants) {
    const key = variantKey(v);
    if (!key || out.some((m) => m.key === key)) continue;
    out.push({ key, label: v.measure?.trim() || v.sku!.trim(), sku: v.sku?.trim() || null, measure: v.measure?.trim() || null });
  }
  return out;
}

/** Las marcas que valen: de medidas de la ficha y, si están todas, ninguna, porque es de todas. */
function knownVariants(keys: string[], measures: Measure[]): string[] {
  if (measures.length < 2) return [];
  const known = keys.filter((k) => measures.some((m) => m.key === k));
  return new Set(known).size >= measures.length ? [] : known;
}

/** La foto con las marcas que valen: medidas y orden de medidas de la ficha. */
function knownMarks<T extends PhotoRef>(ref: T, measures: Measure[]): T {
  const positions =
    measures.length >= 2 ? Object.fromEntries(Object.entries(ref.positions ?? {}).filter(([k]) => measures.some((m) => m.key === k))) : {};
  return withMarks(ref, { ...ref, variants: knownVariants(photoVariants(ref), measures), positions });
}

/**
 * La medida que vende una publicación que en el canal no tiene medidas, de un
 * producto que sí las tiene: cuando cada medida se publica aparte. Sale de su
 * SKU en el canal. Null si no es el caso.
 */
export function soleMeasureOf(measures: Measure[], copy: { variations: unknown; details: unknown } | null): Measure | null {
  if (!copy || measures.length < 2 || parseVariations(copy.variations).length > 0) return null;
  const skus = new Set(copySkus(copy.details).map((s) => s.trim().toUpperCase()));
  const found = measures.filter((m) => m.sku && skus.has(m.sku.toUpperCase()));
  return found.length === 1 ? found[0] : null;
}

/** Las fotos de una publicación que vende una sola medida: las de esa medida, en su orden, sin marcas. */
export function soleMeasurePhotos<T extends PhotoRef>(refs: T[], measures: Measure[], sole: Measure): T[] {
  return variantPhotos(
    refs.map((r) => knownMarks(r, measures)),
    sole.key,
  ).map((r) => withMarks(r, { ...r, variants: [], positions: {} }));
}

/**
 * Las otras publicaciones de la tienda que comparten las fotos con esta en el
 * canal: las del mismo producto del canal. Si de alguna de las dos todavía no
 * se sabe cuál es, las del mismo producto que venden la misma medida sola.
 */
export async function photoSiblings(
  db: Db,
  p: { id: string; productId: string; storeId: string; copy: { variations: unknown; details: unknown } | null },
): Promise<{ id: string; externalId: string }[]> {
  const channelProduct = p.copy ? copyChannelProduct(p.copy.details) : null;
  const measures = measuresOf(
    await db.productVariant.findMany({ where: { productId: p.productId }, orderBy: { position: 'asc' }, select: { sku: true, measure: true } }),
  );
  const sole = soleMeasureOf(measures, p.copy);
  if (!channelProduct && !sole) return [];
  const rows = await db.publication.findMany({
    where: {
      storeId: p.storeId,
      id: { not: p.id },
      externalId: { not: null },
      OR: [
        ...(channelProduct ? [{ channelCopy: { details: { path: ['channelProductId'], equals: channelProduct } } }] : []),
        ...(sole ? [{ productId: p.productId }] : []),
      ],
    },
    orderBy: { externalId: 'asc' },
    select: { id: true, externalId: true, productId: true, channelCopy: { select: { variations: true, details: true } } },
  });
  return rows
    .filter((r) => {
      const theirs = r.channelCopy ? copyChannelProduct(r.channelCopy.details) : null;
      if (channelProduct && theirs) return theirs === channelProduct;
      return sole !== null && r.productId === p.productId && soleMeasureOf(measures, r.channelCopy)?.key === sole.key;
    })
    .map((r) => ({ id: r.id, externalId: r.externalId! }));
}

/** Cuántas fotos ve el comprador en cada medida, con las marcas que valen. */
export function photosPerMeasure(refs: PhotoRef[], measures: Measure[]): { measure: Measure; count: number }[] {
  const marked = refs.map((ref) => knownMarks(ref, measures));
  return measures.map((measure) => ({ measure, count: variantPhotos(marked, measure.key).length }));
}

const viewUrl = (runId: string) => `/api/imagenes/ver?tipo=vista&paso=${encodeURIComponent(runId)}`;

/**
 * Las fotos del paso Imágenes que se pueden usar: las corregidas, con su JPG
 * final aprobado, y las que se usan tal cual, con su original sin tocar.
 */
type FinishedEdit = {
  id: string;
  asIs: boolean;
  file: { url: string; type: string; name: string; size: number | null };
  thumb: string | null;
  // La foto en su tamaño más grande que el navegador puede mostrar, para la lupa.
  zoom: string;
};

// Los originales que el navegador muestra; los demás, como las HEIC, se ven por la vista que armó la Mac.
const SHOWABLE = ['image/jpeg', 'image/png', 'image/webp'];

async function finishedEdits(db: Db, productId: string): Promise<FinishedEdit[]> {
  const edits = await db.photoEdit.findMany({
    where: { productId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      originalName: true,
      originalUrl: true,
      originalType: true,
      originalSize: true,
      previewUrl: true,
      asIs: true,
      runs: {
        where: { step: LAST_PHOTO_STEP, status: 'APPROVED', jpgUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, jpgUrl: true, previewUrl: true },
      },
    },
  });
  return edits.flatMap((e): FinishedEdit[] => {
    if (e.asIs) {
      return [
        {
          id: e.id,
          asIs: true,
          // Va el mismo archivo que se subió, con su nombre.
          file: { url: e.originalUrl, type: e.originalType, name: e.originalName, size: e.originalSize },
          thumb: photoFileHref(e.previewUrl ? 'antes' : 'original', { foto: e.id }),
          zoom: photoFileHref(SHOWABLE.includes(e.originalType) || !e.previewUrl ? 'original' : 'antes', { foto: e.id }),
        },
      ];
    }
    const run = e.runs[0];
    if (!run?.jpgUrl) return [];
    return [
      {
        id: e.id,
        asIs: false,
        // Del Drive: si se retocó a mano desde la Mac, va la versión retocada.
        file: { url: run.jpgUrl, type: 'image/jpeg', name: `${e.originalName.replace(/\.[^.]+$/, '')}.jpg`, size: null },
        thumb: run.previewUrl ? viewUrl(run.id) : null,
        zoom: photoFileHref('jpg', { paso: run.id }),
      },
    ];
  });
}

/** Cómo se nombra una foto del paso Imágenes en la lista. */
const editLabel = (e: { asIs: boolean }, n: number) => (e.asIs ? `Original ${n}, sin editar` : `Corregida ${n}`);

/** De qué foto corregida salió cada foto que la app subió al canal, por su código allá. */
export function photoOriginsOf(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

/** Las fotos del paso Imágenes que ya pueden ir a una publicación: las corregidas aprobadas y las que se usan tal cual. */
export async function readyPhotoIds(db: Db, productId: string): Promise<Set<string>> {
  return new Set((await finishedEdits(db, productId)).map((e) => e.id));
}

/**
 * Las publicaciones del producto, con sus fotos elegidas (o null si siguen a
 * las del canal), las del canal, y cómo ve las medidas cada una: las que se
 * pueden marcar y la que vende sola, igual que en Organización de multimedia.
 */
export async function productPublicationsMedia(db: Db, productId: string) {
  const [variants, pubs] = await Promise.all([
    db.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' }, select: { sku: true, measure: true } }),
    db.publication.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        videoVariants: true,
        channelCopy: { select: { photos: true, photoIds: true, variations: true, details: true, missingSince: true } },
      },
    }),
  ]);
  const allMeasures = measuresOf(variants);
  return pubs.map((p) => {
    const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
    const sole = soleMeasureOf(allMeasures, copy);
    const measures: PublicationMeasures = { measures: sole || allMeasures.length < 2 ? [] : allMeasures.map((m) => m.key), sole: sole?.key ?? null };
    return {
      id: p.id,
      videoVariants: parseVideoVariants(p.videoVariants),
      channelRefs: channelPhotos(copy?.photos, copy?.photoIds, copy?.variations),
      measures,
    };
  });
}

export async function loadMediaSources(db: Db, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      productId: true,
      externalId: true,
      media: true,
      videoVariants: true,
      store: { select: { id: true, channel: { select: { kind: true, name: true } } } },
      product: {
        select: {
          assets: { where: { kind: 'PHOTO' }, orderBy: { position: 'asc' }, select: { url: true } },
          variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
          videos: {
            where: { goneAt: null },
            orderBy: [{ driveCreatedAt: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, mimeType: true, size: true, width: true, height: true, durationMs: true, measuredBy: true },
          },
        },
      },
      clips: { orderBy: [{ position: 'asc' }, { chosenAt: 'asc' }], select: { videoId: true } },
      channelCopy: { select: { photos: true, photoIds: true, photoOrigins: true, variations: true, details: true, missingSince: true } },
    },
  });
  if (!p) throw new MediaError('La publicación no está en la cuenta.');
  const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
  const channelName = adapter.name;
  const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
  const allMeasures = measuresOf(p.product.variants);
  // Si vende una sola medida, todas las fotos van a ella: no hay medidas para marcar.
  const sole = soleMeasureOf(allMeasures, copy);
  const measures = sole ? [] : allMeasures;
  const marks = (keys: string[]) => knownVariants(keys, measures);
  const origins = photoOriginsOf(copy?.photoOrigins);
  const edits = await finishedEdits(db, p.productId);
  const editName = new Map(edits.map((e, i) => [e.id, editLabel(e, i + 1)]));

  const channel: MediaItem[] = channelPhotos(copy?.photos, copy?.photoIds, copy?.variations).map((ref, i) => {
    const from = origins[ref.kind === 'channel' ? ref.id : ''];
    return {
      ref,
      key: photoKey(ref),
      thumb: ref.kind === 'channel' ? ref.url || null : null,
      label: `En ${channelName}, foto ${i + 1}`,
      note: from && editName.has(from) ? `Es ${editName.get(from)!.startsWith('Original') ? 'el' : 'la'} ${editName.get(from)!.toLowerCase()}` : null,
    };
  });
  const inChannel = new Set(channel.map((c) => (c.ref.kind === 'channel' ? origins[c.ref.id] : undefined)).filter(Boolean));
  const corrected: MediaItem[] = edits.map((e, i) => {
    // La que se usa tal cual tiene que poder ir al canal como está.
    const blocked = e.asIs && e.file.size !== null ? asIsProblem({ type: e.file.type, size: e.file.size }, adapter.photos, channelName) : null;
    return {
      ref: { kind: 'edit', editId: e.id },
      key: photoKey({ kind: 'edit', editId: e.id }),
      thumb: e.thumb,
      zoom: e.zoom,
      label: editLabel(e, i + 1),
      note: blocked ?? (inChannel.has(e.id) ? `Ya está en ${channelName}` : null),
      ...(blocked ? { blocked } : {}),
    };
  });
  const channelUrls = new Set(channel.map((c) => c.thumb));
  const assets: MediaItem[] = p.product.assets
    .filter((a) => !channelUrls.has(a.url) && /^https?:\/\//.test(a.url))
    .map((a, i) => ({ ref: { kind: 'asset', url: a.url }, key: photoKey({ kind: 'asset', url: a.url }), thumb: a.url, label: `Del producto ${i + 1}`, note: null }));

  const all = new Map([...channel, ...corrected, ...assets].map((m) => [m.key, m]));
  const saved = parseMedia(p.media);
  const media = saved && sole ? soleMeasurePhotos(saved, allMeasures, sole) : saved;
  const current = (media ?? channel.map((c) => c.ref)).map((ref): MediaItem => {
    const found = all.get(photoKey(ref)) ?? {
      ref,
      key: photoKey(ref),
      thumb: ref.kind === 'edit' ? null : ref.url || null,
      label: ref.kind === 'edit' ? 'Corregida' : 'Foto',
      note: 'Ya no está disponible',
    };
    // Con las medidas que tiene en esta publicación; las que ya no están en la ficha se caen.
    const kept = marks(photoVariants(ref));
    const lost = measures.length >= 2 && photoVariants(ref).some((k) => !kept.includes(k)) && kept.length === 0;
    return { ...found, ref: withMarks(found.ref, knownMarks(ref, measures)), note: lost ? 'Su medida ya no está en la ficha: quedó en Todas' : found.note };
  });
  // Las que se pueden elegir, sin marcas: al agregarlas son de todas.
  const plain = (list: MediaItem[]) => list.map((m) => ({ ...m, ref: withMarks(m.ref, { ...m.ref, variants: [], positions: {} }) }));
  const videoMarks = parseVideoVariants(p.videoVariants);
  const clipRules = adapter.clips;
  const variations = parseVariations(copy?.variations);
  return {
    publication: { id: p.id, productId: p.productId, externalId: p.externalId },
    channelName,
    // Sin elegir: usa las del canal.
    following: media === null,
    current,
    available: { channel: plain(channel), corrected, assets },
    // Las medidas que se pueden marcar: con menos de dos, no hay nada que elegir.
    measures: measures.length >= 2 ? measures : [],
    // Leída del canal y sin variantes: allá todas las fotos se ven juntas.
    channelWithoutVariants: copy !== null && measures.length >= 2 && variations.length === 0,
    // Vende una sola medida del producto, por su SKU: todas las fotos van a ella.
    soleMeasure: sole ? { label: sole.label, sku: sole.sku } : null,
    // Las otras publicaciones que comparten las fotos en el canal: cambian con estas.
    sharedWith: (
      await photoSiblings(db, { id: p.id, productId: p.productId, storeId: p.store.id, copy })
    ).map((s) => s.externalId),
    // Los videos del producto, para mirarlos, elegir el clip y marcar sus medidas.
    videos: p.product.videos.map((v) => {
      const measure = { name: v.name, mimeType: v.mimeType, size: v.size === null ? null : Number(v.size), width: v.width, height: v.height, durationMs: v.durationMs };
      return {
        id: v.id,
        name: v.name,
        durationMs: v.durationMs,
        width: v.width,
        height: v.height,
        size: measure.size,
        measuredByBrowser: v.measuredBy === BY_BROWSER,
        check: clipRules ? checkClip(measure, clipRules) : null,
        variants: marks(videoMarks[v.id] ?? []),
      };
    }),
    // Cómo llama el canal a los clips, y los elegidos, en orden.
    clip: clipRules ? { name: clipRules.name, perVariant: clipRules.perVariant } : null,
    clipIds: p.clips.map((c) => c.videoId),
  };
}

export type MediaSources = Awaited<ReturnType<typeof loadMediaSources>>;

/**
 * Guarda las fotos elegidas, en orden. Null vuelve a usar las del canal. Solo
 * acepta fotos que la publicación puede usar.
 */
export async function saveMedia(
  db: Db,
  args: {
    accountId: string;
    publicationId: string;
    refs?: PhotoRef[] | null;
    videos?: Record<string, string[]>;
    // Los videos que van como clip, en orden. Sin mandar, quedan como están.
    clips?: string[];
    userId?: string | null;
  },
): Promise<void> {
  const sources = await loadMediaSources(db, args.accountId, args.publicationId);
  const keys = (list: string[]) => knownVariants(list, sources.measures);
  const data: Prisma.PublicationUpdateInput = {};
  if (args.videos) {
    const known = new Set(sources.videos.map((v) => v.id));
    data.videoVariants = Object.fromEntries(
      Object.entries(args.videos).flatMap(([id, list]) => (known.has(id) && keys(list).length > 0 ? [[id, [...new Set(keys(list))].sort()]] : [])),
    );
  }
  if (args.refs === null) data.media = Prisma.DbNull;
  else if (args.refs) {
    const refs = cleanMedia(args.refs).map((r) => knownMarks(r, sources.measures));
    if (refs.length === 0) throw new MediaError('Elegí al menos una foto.');
    const allowed = new Set([...sources.available.channel, ...sources.available.corrected, ...sources.available.assets].map((m) => m.key));
    if (refs.some((r) => !allowed.has(photoKey(r)))) throw new MediaError('Una de las fotos ya no está disponible. Recargá la página.');
    const blocked = sources.available.corrected.find((m) => m.blocked && refs.some((r) => photoKey(r) === m.key));
    if (blocked) throw new MediaError(`${blocked.label}: ${blocked.blocked}`);
    // Las del canal se guardan con su link, para verlas aunque cambie la lectura.
    const byKey = new Map(sources.available.channel.map((m) => [m.key, m.ref]));
    data.media = refs.map((r) => withMarks(byKey.get(photoKey(r)) ?? r, r)) as Prisma.InputJsonValue;
  }
  if (Object.keys(data).length > 0) await db.publication.update({ where: { id: args.publicationId }, data });
  if (args.clips) await setClips(db, { accountId: args.accountId, publicationId: args.publicationId, videoIds: args.clips, userId: args.userId ?? null });
}

/**
 * El archivo de una foto del paso Imágenes, para subirlo al canal: el JPG
 * final de la corregida o el original de la que se usa tal cual. Null si ya no está.
 */
export async function correctedPhotoFile(db: PrismaClient, productId: string, editId: string): Promise<{ data: Uint8Array; type: string; name: string } | null> {
  const edit = (await finishedEdits(db, productId)).find((e) => e.id === editId);
  if (!edit) return null;
  const res = await readStored(db, edit.file.url);
  if (!res) return null;
  return { data: new Uint8Array(await res.arrayBuffer()), type: edit.file.type, name: edit.file.name };
}

/**
 * Las fotos, como las pide el canal: las corregidas se suben como archivo. Con
 * varias medidas en la ficha, también qué fotos ve el comprador en cada una.
 */
export async function picturesFor(
  db: PrismaClient,
  productId: string,
  refs: PhotoRef[],
  // Lo que se leyó del canal: si vende una sola medida, van las de esa medida, sin repartir.
  copy: { variations: unknown; details: unknown } | null = null,
) {
  const variants = await db.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' }, select: { sku: true, measure: true } });
  const allMeasures = measuresOf(variants);
  const sole = soleMeasureOf(allMeasures, copy);
  const measures = sole ? [] : allMeasures;
  const chosen = sole ? soleMeasurePhotos(refs, allMeasures, sole) : refs;
  const pictures: ChannelPicture[] = [];
  const origins: (string | null)[] = [];
  const problems: string[] = [];
  const sent: PhotoRef[] = [];
  for (const ref of chosen) {
    if (ref.kind === 'channel') pictures.push({ kind: 'existing', id: ref.id });
    else if (ref.kind === 'asset') pictures.push({ kind: 'link', url: ref.url });
    else {
      const file = await correctedPhotoFile(db, productId, ref.editId);
      if (!file) {
        problems.push('Una foto del paso Imágenes ya no está disponible: sacala de la lista.');
        continue;
      }
      pictures.push({ kind: 'file', ...file });
    }
    origins.push(ref.kind === 'edit' ? ref.editId : null);
    sent.push(ref);
  }
  // Cada foto con las medidas que valen, y su lugar en la lista.
  const marked = sent.map((ref) => knownMarks(ref, measures));
  const placed = marked.map((ref, at) => ({ ...ref, at }));
  const layout: ChannelPictureLayout = {
    variants: measures.length >= 2 ? measures.map((m) => ({ sku: m.sku, measure: m.measure, pictures: variantPhotos(placed, m.key).map((r) => r.at) })) : [],
    general: placed.filter((r) => photoVariants(r).length === 0).map((r) => r.at),
  };
  // sent: las fotos que van, con las medidas con que van, en el mismo orden que pictures.
  return { pictures, origins, problems, layout, sent: marked };
}

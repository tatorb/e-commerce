import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import type { ChannelPicture, ChannelPictureLayout } from '@/channels/publish';
import {
  channelPhotos,
  cleanMedia,
  MAX_PHOTOS,
  parseMedia,
  parseVariations,
  parseVideoVariants,
  photoKey,
  photoVariants,
  variantKey,
  variantPhotos,
  withVariants,
  type PhotoRef,
  type VariantLike,
} from '@/domain/media';
import { LAST_PHOTO_STEP } from '@/domain/photo-steps';
import { readStored } from '@/lib/stored-files';

// Las fotos de una publicación: de dónde se pueden tomar (las que ya están en
// el canal, las corregidas en el paso Imágenes y las del producto) y cuáles
// quedaron elegidas, en orden. Si el producto tiene varias medidas, también de
// cuáles es cada foto y cada video. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

export class MediaError extends Error {}

export type MediaItem = {
  ref: PhotoRef;
  key: string;
  // Cómo se ve: el link de la foto, o la vista liviana de la corregida.
  thumb: string | null;
  label: string;
  note: string | null;
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

const viewUrl = (runId: string) => `/api/imagenes/ver?tipo=vista&paso=${encodeURIComponent(runId)}`;

/** El último intento terminado de cada foto corregida, con su JPG final. */
async function finishedEdits(db: Db, productId: string) {
  const edits = await db.photoEdit.findMany({
    where: { productId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      originalName: true,
      runs: {
        where: { step: LAST_PHOTO_STEP, status: 'APPROVED', jpgUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, jpgUrl: true, previewUrl: true },
      },
    },
  });
  return edits.filter((e) => e.runs.length > 0).map((e) => ({ id: e.id, name: e.originalName, run: e.runs[0] }));
}

/** De qué foto corregida salió cada foto que la app subió al canal, por su código allá. */
export function photoOriginsOf(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
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
      store: { select: { channel: { select: { kind: true, name: true } } } },
      product: {
        select: {
          assets: { where: { kind: 'PHOTO' }, orderBy: { position: 'asc' }, select: { url: true } },
          variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
          videos: {
            where: { goneAt: null },
            orderBy: [{ driveCreatedAt: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, durationMs: true },
          },
        },
      },
      clip: { select: { videoId: true } },
      channelCopy: { select: { photos: true, photoIds: true, photoOrigins: true, variations: true, missingSince: true } },
    },
  });
  if (!p) throw new MediaError('La publicación no está en la cuenta.');
  const adapter = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
  const channelName = adapter.name;
  const measures = measuresOf(p.product.variants);
  const marks = (keys: string[]) => knownVariants(keys, measures);
  const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
  const origins = photoOriginsOf(copy?.photoOrigins);
  const edits = await finishedEdits(db, p.productId);
  const editNumber = new Map(edits.map((e, i) => [e.id, i + 1]));

  const channel: MediaItem[] = channelPhotos(copy?.photos, copy?.photoIds, copy?.variations).map((ref, i) => {
    const from = origins[ref.kind === 'channel' ? ref.id : ''];
    return {
      ref,
      key: photoKey(ref),
      thumb: ref.kind === 'channel' ? ref.url || null : null,
      label: `En ${channelName}, foto ${i + 1}`,
      note: from && editNumber.has(from) ? `Es la corregida ${editNumber.get(from)}` : null,
    };
  });
  const inChannel = new Set(channel.map((c) => (c.ref.kind === 'channel' ? origins[c.ref.id] : undefined)).filter(Boolean));
  const corrected: MediaItem[] = edits.map((e, i) => ({
    ref: { kind: 'edit', editId: e.id },
    key: photoKey({ kind: 'edit', editId: e.id }),
    thumb: e.run.previewUrl ? viewUrl(e.run.id) : null,
    label: `Corregida ${i + 1}`,
    note: inChannel.has(e.id) ? `Ya está en ${channelName}` : null,
  }));
  const channelUrls = new Set(channel.map((c) => c.thumb));
  const assets: MediaItem[] = p.product.assets
    .filter((a) => !channelUrls.has(a.url) && /^https?:\/\//.test(a.url))
    .map((a, i) => ({ ref: { kind: 'asset', url: a.url }, key: photoKey({ kind: 'asset', url: a.url }), thumb: a.url, label: `Del producto ${i + 1}`, note: null }));

  const all = new Map([...channel, ...corrected, ...assets].map((m) => [m.key, m]));
  const media = parseMedia(p.media);
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
    return { ...found, ref: withVariants(found.ref, kept), note: lost ? 'Su medida ya no está en la ficha: quedó en Todas' : found.note };
  });
  // Las que se pueden elegir, sin marcas: al agregarlas son de todas.
  const plain = (list: MediaItem[]) => list.map((m) => ({ ...m, ref: withVariants(m.ref, []) }));
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
    max: MAX_PHOTOS,
    // Las medidas que se pueden marcar: con menos de dos, no hay nada que elegir.
    measures: measures.length >= 2 ? measures : [],
    // Leída del canal y sin variantes: allá todas las fotos se ven juntas.
    channelWithoutVariants: copy !== null && measures.length >= 2 && variations.length === 0,
    videos: p.product.videos.map((v) => ({ id: v.id, name: v.name, durationMs: v.durationMs, variants: marks(videoMarks[v.id] ?? []) })),
    clip: clipRules ? { videoId: p.clip?.videoId ?? null, name: clipRules.name, perVariant: clipRules.perVariant } : null,
  };
}

export type MediaSources = Awaited<ReturnType<typeof loadMediaSources>>;

/**
 * Guarda las fotos elegidas, en orden. Null vuelve a usar las del canal. Solo
 * acepta fotos que la publicación puede usar.
 */
export async function saveMedia(
  db: Db,
  args: { accountId: string; publicationId: string; refs?: PhotoRef[] | null; videos?: Record<string, string[]> },
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
    const refs = cleanMedia(args.refs);
    if (refs.length === 0) throw new MediaError('Elegí al menos una foto.');
    if (args.refs.length > MAX_PHOTOS) throw new MediaError(`Se pueden elegir hasta ${MAX_PHOTOS} fotos.`);
    const allowed = new Set([...sources.available.channel, ...sources.available.corrected, ...sources.available.assets].map((m) => m.key));
    if (refs.some((r) => !allowed.has(photoKey(r)))) throw new MediaError('Una de las fotos ya no está disponible. Recargá la página.');
    // Las del canal se guardan con su link, para verlas aunque cambie la lectura.
    const byKey = new Map(sources.available.channel.map((m) => [m.key, m.ref]));
    data.media = refs.map((r) => withVariants(byKey.get(photoKey(r)) ?? r, keys(photoVariants(r)))) as Prisma.InputJsonValue;
  }
  if (Object.keys(data).length > 0) await db.publication.update({ where: { id: args.publicationId }, data });
}

/** El JPG final de una foto corregida, para subirlo al canal. Null si ya no está. */
export async function correctedPhotoFile(db: PrismaClient, productId: string, editId: string): Promise<{ data: Uint8Array; type: string; name: string } | null> {
  const edit = (await finishedEdits(db, productId)).find((e) => e.id === editId);
  if (!edit?.run.jpgUrl) return null;
  // Del Drive: si se retocó a mano desde la Mac, va la versión retocada.
  const res = await readStored(db, edit.run.jpgUrl);
  if (!res) return null;
  return { data: new Uint8Array(await res.arrayBuffer()), type: 'image/jpeg', name: `${edit.name.replace(/\.[^.]+$/, '')}.jpg` };
}

/**
 * Las fotos, como las pide el canal: las corregidas se suben como archivo. Con
 * varias medidas en la ficha, también qué fotos ve el comprador en cada una.
 */
export async function picturesFor(db: PrismaClient, productId: string, refs: PhotoRef[]) {
  const pictures: ChannelPicture[] = [];
  const origins: (string | null)[] = [];
  const problems: string[] = [];
  const sent: PhotoRef[] = [];
  for (const ref of refs) {
    if (ref.kind === 'channel') pictures.push({ kind: 'existing', id: ref.id });
    else if (ref.kind === 'asset') pictures.push({ kind: 'link', url: ref.url });
    else {
      const file = await correctedPhotoFile(db, productId, ref.editId);
      if (!file) {
        problems.push('Una foto corregida ya no está disponible: sacala de la lista.');
        continue;
      }
      pictures.push({ kind: 'file', ...file });
    }
    origins.push(ref.kind === 'edit' ? ref.editId : null);
    sent.push(ref);
  }
  const variants = await db.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' }, select: { sku: true, measure: true } });
  const measures = measuresOf(variants);
  // Cada foto con las medidas que valen, y su lugar en la lista.
  const marked = sent.map((ref) => withVariants(ref, knownVariants(photoVariants(ref), measures)));
  const placed = marked.map((ref, at) => ({ ...ref, at }));
  const layout: ChannelPictureLayout = {
    variants: measures.length >= 2 ? measures.map((m) => ({ sku: m.sku, measure: m.measure, pictures: variantPhotos(placed, m.key).map((r) => r.at) })) : [],
    general: placed.filter((r) => photoVariants(r).length === 0).map((r) => r.at),
  };
  // sent: las fotos que van, con las medidas con que van, en el mismo orden que pictures.
  return { pictures, origins, problems, layout, sent: marked };
}

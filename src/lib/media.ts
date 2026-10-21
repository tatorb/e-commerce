import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import type { ChannelPicture } from '@/channels/publish';
import { channelPhotos, cleanMedia, MAX_PHOTOS, parseMedia, photoKey, type PhotoRef } from '@/domain/media';
import { LAST_PHOTO_STEP } from '@/domain/photo-steps';
import { readBlob } from '@/lib/files';

// Las fotos de una publicación: de dónde se pueden tomar (las que ya están en
// el canal, las corregidas en el paso Imágenes y las del producto) y cuáles
// quedaron elegidas, en orden. Recibe la base por parámetro para poder probarlo.

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
      store: { select: { channel: { select: { kind: true, name: true } } } },
      product: { select: { assets: { where: { kind: 'PHOTO' }, orderBy: { position: 'asc' }, select: { url: true } } } },
      channelCopy: { select: { photos: true, photoIds: true, photoOrigins: true, missingSince: true } },
    },
  });
  if (!p) throw new MediaError('La publicación no está en la cuenta.');
  const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
  const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
  const origins = photoOriginsOf(copy?.photoOrigins);
  const edits = await finishedEdits(db, p.productId);
  const editNumber = new Map(edits.map((e, i) => [e.id, i + 1]));

  const channel: MediaItem[] = channelPhotos(copy?.photos, copy?.photoIds).map((ref, i) => {
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
  const current = (media ?? channel.map((c) => c.ref)).map(
    (ref): MediaItem =>
      all.get(photoKey(ref)) ?? {
        ref,
        key: photoKey(ref),
        thumb: ref.kind === 'edit' ? null : ref.url || null,
        label: ref.kind === 'edit' ? 'Corregida' : 'Foto',
        note: 'Ya no está disponible',
      },
  );
  return {
    publication: { id: p.id, productId: p.productId, externalId: p.externalId },
    channelName,
    // Sin elegir: usa las del canal.
    following: media === null,
    current,
    available: { channel, corrected, assets },
    max: MAX_PHOTOS,
  };
}

export type MediaSources = Awaited<ReturnType<typeof loadMediaSources>>;

/**
 * Guarda las fotos elegidas, en orden. Null vuelve a usar las del canal. Solo
 * acepta fotos que la publicación puede usar.
 */
export async function saveMedia(db: Db, args: { accountId: string; publicationId: string; refs: PhotoRef[] | null }): Promise<void> {
  const sources = await loadMediaSources(db, args.accountId, args.publicationId);
  if (args.refs === null) {
    await db.publication.update({ where: { id: args.publicationId }, data: { media: Prisma.DbNull } });
    return;
  }
  const refs = cleanMedia(args.refs);
  if (refs.length === 0) throw new MediaError('Elegí al menos una foto.');
  if (args.refs.length > MAX_PHOTOS) throw new MediaError(`Se pueden elegir hasta ${MAX_PHOTOS} fotos.`);
  const allowed = new Set([...sources.available.channel, ...sources.available.corrected, ...sources.available.assets].map((m) => m.key));
  if (refs.some((r) => !allowed.has(photoKey(r)))) throw new MediaError('Una de las fotos ya no está disponible. Recargá la página.');
  // Las del canal se guardan con su link, para verlas aunque cambie la lectura.
  const byKey = new Map(sources.available.channel.map((m) => [m.key, m.ref]));
  await db.publication.update({
    where: { id: args.publicationId },
    data: { media: refs.map((r) => byKey.get(photoKey(r)) ?? r) as Prisma.InputJsonValue },
  });
}

/** El JPG final de una foto corregida, para subirlo al canal. Null si ya no está. */
export async function correctedPhotoFile(db: Db, productId: string, editId: string): Promise<{ data: Uint8Array; type: string; name: string } | null> {
  const edit = (await finishedEdits(db, productId)).find((e) => e.id === editId);
  if (!edit?.run.jpgUrl) return null;
  const res = await readBlob(edit.run.jpgUrl);
  if (!res) return null;
  return { data: new Uint8Array(await res.arrayBuffer()), type: 'image/jpeg', name: `${edit.name.replace(/\.[^.]+$/, '')}.jpg` };
}

/** Las fotos, como las pide el canal: las corregidas se suben como archivo. */
export async function picturesFor(db: Db, productId: string, refs: PhotoRef[]) {
  const pictures: ChannelPicture[] = [];
  const origins: (string | null)[] = [];
  const problems: string[] = [];
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
  }
  return { pictures, origins, problems };
}

import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { channelPhotos, parseMedia, photoKey, placeFixedPhotos, withMarks, type PhotoRef } from '@/domain/media';
import { photoOriginsOf, photoSiblings, productPublicationsMedia } from '@/lib/media';
import { textImagePng } from './files';

// El código que el canal le da a cada imagen con texto en cada publicación (en
// Mercado Libre, una por medida). Con él la app sabe cuál de las fotos del
// canal es la imagen con texto, aunque el orden allá haya cambiado: al
// regenerar el PNG se reemplaza esa foto y no otra. Se guarda al subirla y,
// para las que ya estaban en el canal, comparando las fotos del canal con el PNG.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

// ───────────────────────────── Al subir ─────────────────────────────

/** Guarda el código que el canal le dio a cada imagen con texto que se subió a la publicación. */
export async function saveSentTextCodes(db: Db | Tx, publicationId: string, sent: { textImageId: string; photoId: string }[], now: Date): Promise<void> {
  if (sent.length === 0) return;
  const pngs = new Map(
    (await db.textImage.findMany({ where: { id: { in: sent.map((s) => s.textImageId) } }, select: { id: true, pngAt: true } })).map((t) => [t.id, t.pngAt]),
  );
  for (const s of sent) {
    if (!pngs.has(s.textImageId)) continue;
    const data = { channelPhotoId: s.photoId, channelPhotoAt: now, channelPngAt: pngs.get(s.textImageId) ?? null, channelFound: false, channelCheckedKey: null };
    await db.publicationTextImage.upsert({
      where: { publicationId_textImageId: { publicationId, textImageId: s.textImageId } },
      create: { publicationId, textImageId: s.textImageId, ...data },
      update: data,
    });
  }
}

/** Las que se subieron, con su código: de pictures y los códigos que devolvió el canal, en el mismo orden. */
export function sentTextCodes(texts: (string | null)[], ids: (string | null | undefined)[] | null): { textImageId: string; photoId: string }[] {
  if (!ids) return [];
  return texts.flatMap((t, i) => (t && ids[i] ? [{ textImageId: t, photoId: ids[i]! }] : []));
}

// ───────────────────────────── Cuál es en el canal ─────────────────────────────

export type ChannelTextMark = { textImageId: string; slot: number; fromDrive: boolean; fileName: string | null; photoId: string; found: boolean; outdated: boolean };

/**
 * Las imágenes con texto que están entre las fotos del canal de la
 * publicación, por su código. Vale también para las que comparten las fotos
 * (las otras opciones de venta), aunque el código se haya guardado en la principal.
 */
export async function channelTextMarks(db: Db | Tx, args: { productId: string; photoIds: string[] }): Promise<Map<string, ChannelTextMark>> {
  if (args.photoIds.length === 0) return new Map();
  const links = await db.publicationTextImage.findMany({
    where: { channelPhotoId: { in: args.photoIds }, publication: { productId: args.productId } },
    select: { channelPhotoId: true, channelFound: true, channelPngAt: true, textImage: { select: { id: true, slot: true, fromDrive: true, fileName: true, pngAt: true } } },
  });
  const out = new Map<string, ChannelTextMark>();
  for (const l of links) {
    if (out.has(l.channelPhotoId!)) continue;
    out.set(l.channelPhotoId!, {
      textImageId: l.textImage.id,
      slot: l.textImage.slot,
      fromDrive: l.textImage.fromDrive,
      fileName: l.textImage.fileName,
      photoId: l.channelPhotoId!,
      found: l.channelFound,
      // Se subió un PNG más viejo que el de ahora.
      outdated: Boolean(l.channelPngAt && l.textImage.pngAt && l.channelPngAt.getTime() < l.textImage.pngAt.getTime()),
    });
  }
  return out;
}

/** Cómo se nombra en la lista de las fotos del canal. */
export function channelTextNote(m: ChannelTextMark): string {
  const name = m.fromDrive ? `la imagen con texto del Drive ${m.fileName ?? ''}`.trim() : `la imagen con texto ${m.slot}`;
  return `Es ${name}${m.outdated ? ', con un PNG anterior al de ahora' : ''}${m.found ? ' (reconocida comparando las fotos)' : ''}`;
}

// ───────────────────────────── Reconocer las que ya estaban ─────────────────────────────

/** Huella de la imagen: 16 × 16 comparaciones de brillo entre vecinos, en gris. */
type Print = Uint8Array;

const PRINT_W = 17;
const PRINT_H = 16;
// Cuántas de las 256 pueden ser distintas para que sea la misma imagen.
const SAME_MAX = 28;
// Cuánto mejor tiene que ser que la segunda, para no confundir dos parecidas.
const MARGIN = 12;
// Las fotos del canal que se comparan por publicación, como mucho.
const MAX_CANDIDATES = 15;

async function printOf(data: Uint8Array): Promise<{ print: Print; square: boolean } | null> {
  const sharp = (await import('sharp')).default;
  try {
    const img = sharp(Buffer.from(data));
    const meta = await img.metadata();
    const raw = await img.flatten({ background: '#ffffff' }).grayscale().resize(PRINT_W, PRINT_H, { fit: 'fill' }).raw().toBuffer();
    const bits = new Uint8Array(PRINT_H * (PRINT_W - 1));
    for (let y = 0; y < PRINT_H; y++) for (let x = 0; x < PRINT_W - 1; x++) bits[y * (PRINT_W - 1) + x] = raw[y * PRINT_W + x] > raw[y * PRINT_W + x + 1] ? 1 : 0;
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    return { print: bits, square: w > 0 && Math.abs(w - h) <= 2 };
  } catch {
    return null;
  }
}

function distance(a: Print, b: Print): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export type ImageLoaders = {
  // El PNG de la imagen con texto.
  png: (textImageId: string) => Promise<Uint8Array | null>;
  // Una foto del canal, por su link.
  photo: (url: string) => Promise<Uint8Array | null>;
};

const defaultLoaders = (db: Db): ImageLoaders => ({
  png: async (id) => (await textImagePng(db, id))?.data ?? null,
  photo: async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  },
});

export type FoundCode = { publicationId: string; externalId: string | null; textImageId: string; slot: number; photoId: string; position: number };

/**
 * Para las imágenes con texto que no tienen código en una publicación: compara
 * las fotos del canal con el PNG y, si una es la misma imagen, guarda su
 * código. Las fotos corregidas que subió la app ya se saben y no se comparan.
 * Lo ya comparado no se vuelve a comparar hasta que cambien las fotos del
 * canal o el PNG.
 */
export async function findTextImagesInChannel(
  db: Db,
  opts: { publicationIds?: string[]; budgetMs: number; loaders?: ImageLoaders; now?: Date },
): Promise<{ found: FoundCode[]; checked: number; pending: boolean }> {
  const started = Date.now();
  const loaders = opts.loaders ?? defaultLoaders(db);
  const links = await db.publicationTextImage.findMany({
    where: {
      channelPhotoId: null,
      textImage: { pngRef: { not: null }, pngAt: { not: null } },
      publication: { externalId: { not: null }, channelCopy: { missingSince: null } },
      ...(opts.publicationIds ? { publicationId: { in: opts.publicationIds } } : {}),
    },
    select: { publicationId: true, channelCheckedKey: true, textImage: { select: { id: true, slot: true, pngAt: true } } },
    orderBy: { publicationId: 'asc' },
  });
  const byPub = new Map<string, typeof links>();
  for (const l of links) byPub.set(l.publicationId, [...(byPub.get(l.publicationId) ?? []), l]);
  const pngPrints = new Map<string, Print | null>();
  const photoPrints = new Map<string, { print: Print; square: boolean } | null>();
  const found: FoundCode[] = [];
  let checked = 0;
  for (const [publicationId, own] of byPub) {
    if (Date.now() - started > opts.budgetMs) return { found, checked, pending: true };
    const p = await db.publication.findUniqueOrThrow({
      where: { id: publicationId },
      select: {
        externalId: true,
        channelCopy: { select: { photos: true, photoIds: true, variations: true, photoOrigins: true } },
        textImages: { where: { channelPhotoId: { not: null } }, select: { channelPhotoId: true } },
      },
    });
    const refs = channelPhotos(p.channelCopy?.photos, p.channelCopy?.photoIds, p.channelCopy?.variations).filter((r): r is Extract<PhotoRef, { kind: 'channel' }> => r.kind === 'channel');
    const keyOf = (pngAt: Date | null) => `${pngAt?.getTime() ?? 0}|${refs.map((r) => r.id).join(',')}`;
    const todo = own.filter((l) => l.channelCheckedKey !== keyOf(l.textImage.pngAt));
    if (todo.length === 0) continue;
    // Las corregidas que subió la app y las que ya son de otra imagen con texto, no.
    const origins = photoOriginsOf(p.channelCopy?.photoOrigins);
    const taken = new Set(p.textImages.map((t) => t.channelPhotoId!));
    const candidates = refs
      .map((r, position) => ({ ...r, position }))
      .filter((r) => r.url && !origins[r.id] && !taken.has(r.id))
      .slice(0, MAX_CANDIDATES);
    for (const c of candidates) {
      if (photoPrints.has(c.id)) continue;
      const data = await loaders.photo(c.url).catch(() => null);
      photoPrints.set(c.id, data ? await printOf(data) : null);
    }
    // Cada imagen con texto con su foto más parecida; si dos quieren la misma, la más parecida.
    const scored: { link: (typeof todo)[number]; photo: (typeof candidates)[number]; d: number }[] = [];
    for (const l of todo) {
      if (!pngPrints.has(l.textImage.id)) {
        const data = await loaders.png(l.textImage.id).catch(() => null);
        pngPrints.set(l.textImage.id, data ? ((await printOf(data))?.print ?? null) : null);
      }
      const mine = pngPrints.get(l.textImage.id);
      if (!mine) continue;
      const ranked = candidates
        .flatMap((c) => {
          const theirs = photoPrints.get(c.id);
          return theirs?.square ? [{ photo: c, d: distance(mine, theirs.print) }] : [];
        })
        .sort((a, b) => a.d - b.d);
      const best = ranked[0];
      if (best && best.d <= SAME_MAX && (ranked.length < 2 || ranked[1].d - best.d >= MARGIN)) scored.push({ link: l, photo: best.photo, d: best.d });
    }
    const used = new Set<string>();
    const matched = new Set<string>();
    const now = opts.now ?? new Date();
    for (const s of scored.sort((a, b) => a.d - b.d)) {
      if (used.has(s.photo.id)) continue;
      used.add(s.photo.id);
      matched.add(s.link.textImage.id);
      await db.publicationTextImage.update({
        where: { publicationId_textImageId: { publicationId, textImageId: s.link.textImage.id } },
        data: { channelPhotoId: s.photo.id, channelPhotoAt: now, channelPngAt: null, channelFound: true, channelCheckedKey: keyOf(s.link.textImage.pngAt) },
      });
      found.push({ publicationId, externalId: p.externalId, textImageId: s.link.textImage.id, slot: s.link.textImage.slot, photoId: s.photo.id, position: s.photo.position + 1 });
    }
    for (const l of todo) {
      checked++;
      if (matched.has(l.textImage.id)) continue;
      await db.publicationTextImage.update({
        where: { publicationId_textImageId: { publicationId, textImageId: l.textImage.id } },
        data: { channelCheckedKey: keyOf(l.textImage.pngAt) },
      });
    }
  }
  return { found, checked, pending: false };
}

// ───────────────────────────── Al regenerar el PNG ─────────────────────────────

export type TextDraft = {
  publicationId: string;
  externalId: string | null;
  // replaced: en el lugar de la foto con ese código. placed: en su lugar fijo, porque el código ya no está. kept: el borrador ya la tenía.
  how: 'replaced' | 'placed' | 'kept' | 'missing';
  // El lugar en que queda, desde 1.
  position: number | null;
  note: string | null;
};

export type TextDraftsResult = {
  drafts: TextDraft[];
  // Las que comparten las fotos en el canal y tenían su propio borrador: se saca, para que se suba solo desde la principal.
  cleared: { publicationId: string; externalId: string | null; from: string | null }[];
  // Las que no tienen código: siguen con el lugar fijo, como antes.
  withoutCode: string[];
};

/**
 * Arma el borrador de multimedia de cada publicación que tiene el código de
 * la imagen con texto: las fotos del canal en el mismo orden (o el borrador
 * que ya tenía), con la imagen nueva en lugar de la foto con ese código. Si el
 * código ya no está en el canal, la imagen va en su lugar fijo y lo avisa. Las
 * otras opciones de venta comparten las fotos en el canal: no llevan borrador.
 * Con dryRun, solo dice qué pasaría.
 */
export async function draftsForTextImage(db: Db, args: { textImageId: string; publicationIds: string[]; dryRun?: boolean }): Promise<TextDraftsResult> {
  const t = await db.textImage.findUniqueOrThrow({ where: { id: args.textImageId }, select: { id: true, slot: true, mediaPlace: true } });
  const links = await db.publicationTextImage.findMany({
    where: { textImageId: t.id, publicationId: { in: args.publicationIds } },
    select: {
      channelPhotoId: true,
      publication: {
        select: {
          id: true,
          externalId: true,
          productId: true,
          storeId: true,
          variantKey: true,
          mainOptionId: true,
          media: true,
          channelCopy: { select: { photos: true, photoIds: true, variations: true, details: true, missingSince: true } },
        },
      },
    },
  });
  const textRef: PhotoRef = { kind: 'text', id: t.id };
  const textKey = photoKey(textRef);
  const out: TextDraftsResult = { drafts: [], cleared: [], withoutCode: [] };
  const views = new Map<string, Map<string, Awaited<ReturnType<typeof productPublicationsMedia>>[number]>>();
  const drafted = new Set<string>();
  for (const l of links) {
    const p = l.publication;
    // Una opción de venta comparte las fotos con su principal: se arma en la principal.
    if (p.mainOptionId) continue;
    if (!l.channelPhotoId || !p.channelCopy || p.channelCopy.missingSince) {
      out.withoutCode.push(p.id);
      continue;
    }
    if (!views.has(p.productId)) views.set(p.productId, new Map((await productPublicationsMedia(db, p.productId)).map((v) => [v.id, v])));
    const view = views.get(p.productId)!.get(p.id);
    const measures = view && !view.measures.sole ? view.measures.measures : [];
    const saved = parseMedia(p.media);
    const base = saved ?? channelPhotos(p.channelCopy.photos, p.channelCopy.photoIds, p.channelCopy.variations);
    const draft: TextDraft = { publicationId: p.id, externalId: p.externalId, how: 'kept', position: null, note: null };
    let next: PhotoRef[] | null = null;
    const at = base.findIndex((r) => r.kind === 'channel' && r.id === l.channelPhotoId);
    if (at >= 0) {
      // En el lugar de la vieja, con sus medidas, y sin la nueva repetida en otro lugar.
      next = base.flatMap((r, i) => (i === at ? [withMarks(textRef, r)] : photoKey(r) === textKey ? [] : [r]));
      draft.how = 'replaced';
    } else if (base.some((r) => photoKey(r) === textKey)) {
      draft.how = 'kept';
    } else if (t.mediaPlace) {
      next = placeFixedPhotos(base, [{ ref: textRef, place: t.mediaPlace }], measures);
      draft.how = 'placed';
      draft.note = `La foto con el código guardado (${l.channelPhotoId}) ya no está en el canal: la imagen con texto ${t.slot} queda en su lugar fijo, el ${t.mediaPlace}. Revisá que no haya quedado repetida.`;
    } else {
      draft.how = 'missing';
      draft.note = `La foto con el código guardado (${l.channelPhotoId}) ya no está en el canal y la imagen con texto ${t.slot} no tiene lugar fijo: elegí su lugar en Organización de multimedia.`;
    }
    const final = next ?? base;
    const pos = final.findIndex((r) => photoKey(r) === textKey);
    draft.position = pos >= 0 ? pos + 1 : null;
    if (next && !args.dryRun) await db.publication.update({ where: { id: p.id }, data: { media: next as Prisma.InputJsonValue } });
    out.drafts.push(draft);
    drafted.add(p.id);
  }
  // Las que comparten las fotos con una que lleva borrador: sin borrador propio, para que no se pisen.
  for (const d of out.drafts.filter((x) => x.how === 'replaced' || x.how === 'placed')) {
    const p = links.find((l) => l.publication.id === d.publicationId)!.publication;
    const siblings = await photoSiblings(db, { id: p.id, productId: p.productId, storeId: p.storeId, variantKey: p.variantKey, copy: p.channelCopy });
    const options = await db.publication.findMany({ where: { mainOptionId: p.id }, select: { id: true } });
    const ids = [...new Set([...siblings.map((s) => s.id), ...options.map((o) => o.id)])].filter((id) => !drafted.has(id));
    if (ids.length === 0) continue;
    const withDraft = await db.publication.findMany({ where: { id: { in: ids }, NOT: { media: { equals: Prisma.DbNull } } }, select: { id: true, externalId: true } });
    for (const s of withDraft) {
      if (out.cleared.some((c) => c.publicationId === s.id)) continue;
      if (!args.dryRun) await db.publication.update({ where: { id: s.id }, data: { media: Prisma.DbNull } });
      out.cleared.push({ publicationId: s.id, externalId: s.externalId, from: d.externalId });
    }
  }
  return out;
}

import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { parseMedia, photoKey, placeFixedPhotos, type PhotoRef } from '@/domain/media';
import { productPublicationsMedia } from '@/lib/media';

// Las imágenes con texto con lugar fijo en Organización de multimedia: le
// ganan al orden del protocolo. Las demás fotos llenan los huecos, en su
// orden. Solo en las publicaciones que ya tienen fotos elegidas: las que
// siguen a las del canal las arman en Organización de multimedia.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** Las imágenes con texto con PNG y lugar fijo de cada publicación. */
export async function fixedTextPlaces(db: Db | Tx, publicationIds: string[]): Promise<Map<string, { ref: PhotoRef; place: number; channelPhotoId: string | null }[]>> {
  const links = await db.publicationTextImage.findMany({
    where: { publicationId: { in: publicationIds }, textImage: { pngRef: { not: null }, mediaPlace: { not: null } } },
    select: { publicationId: true, channelPhotoId: true, textImage: { select: { id: true, mediaPlace: true } } },
  });
  const out = new Map<string, { ref: PhotoRef; place: number; channelPhotoId: string | null }[]>();
  for (const l of links) {
    const list = out.get(l.publicationId) ?? [];
    list.push({ ref: { kind: 'text', id: l.textImage.id }, place: l.textImage.mediaPlace!, channelPhotoId: l.channelPhotoId });
    out.set(l.publicationId, list);
  }
  return out;
}

/**
 * Deja cada imagen con texto con lugar fijo en su lugar, en las fotos elegidas
 * de esas publicaciones. Con remove, saca esas imágenes con texto.
 */
export async function placeTextImages(db: Db, publicationIds: string[], opts: { remove?: string[] } = {}): Promise<void> {
  const pubs = await db.publication.findMany({ where: { id: { in: publicationIds } }, select: { id: true, productId: true } });
  const removed = new Set((opts.remove ?? []).map((id) => photoKey({ kind: 'text', id })));
  for (const productId of [...new Set(pubs.map((p) => p.productId))]) {
    const views = new Map((await productPublicationsMedia(db, productId)).map((v) => [v.id, v]));
    for (const p of pubs.filter((x) => x.productId === productId)) {
      const view = views.get(p.id);
      if (!view) continue;
      await db.$transaction(async (tx) => {
        // Sin pisar un cambio que se guarde a la vez.
        await tx.$queryRaw`SELECT id FROM publications WHERE id = ${p.id} FOR UPDATE`;
        const row = await tx.publication.findUniqueOrThrow({ where: { id: p.id }, select: { media: true } });
        const current = parseMedia(row.media);
        if (!current) return;
        const fixed = ((await fixedTextPlaces(tx, [p.id])).get(p.id) ?? []).filter((f) => !removed.has(photoKey(f.ref)));
        // La versión que ya está en el canal, por su código, no queda repetida al lado de la nueva.
        const old = new Set(fixed.flatMap((f) => (f.channelPhotoId ? [f.channelPhotoId] : [])));
        const kept = current.filter((r) => !removed.has(photoKey(r)) && !(r.kind === 'channel' && old.has(r.id)));
        const next = placeFixedPhotos(
          kept,
          fixed.map((f) => ({ ref: f.ref, place: f.place })),
          view.measures.sole ? [] : view.measures.measures,
        );
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        await tx.publication.update({ where: { id: p.id }, data: { media: next as Prisma.InputJsonValue } });
      });
    }
  }
}

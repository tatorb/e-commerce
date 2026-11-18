import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { measureFromName } from '@/domain/video-measure';
import { measuresOf, type Measure } from '@/lib/media';

// La medida de cada video del producto (src/domain/video-measure.ts): la que
// eligió una persona, la que se grabó en Registro de productos o la que dice el
// nombre del archivo. El clip que arma el editor es de la medida de su video.

type Db = PrismaClient | Prisma.TransactionClient;

export class VideoMeasureError extends Error {}

/** Las medidas de la ficha del producto. */
export async function productMeasures(db: Db, productId: string): Promise<Measure[]> {
  return measuresOf(await db.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' }, select: { sku: true, measure: true } }));
}

/**
 * Busca la medida de los videos del producto que todavía no la tienen: la del
 * nombre del archivo y, en un clip editado, la de su video. No toca los que ya
 * tienen medida ni los que una persona dejó para todas.
 */
export async function findVideoMeasures(db: Db, productId: string): Promise<void> {
  const measures = await productMeasures(db, productId);
  if (measures.length < 2) return;
  const videos = await db.productVideo.findMany({
    where: { productId, goneAt: null, variantKey: null, variantSource: null },
    select: { id: true, name: true, editedBy: { select: { video: { select: { variantKey: true, variantLabel: true, name: true } } } } },
  });
  for (const v of videos) {
    const from = v.editedBy?.video ?? null;
    // El clip es de la medida de su video; si su video tampoco la tiene, la de su nombre.
    const found = from?.variantKey ? { key: from.variantKey, label: from.variantLabel ?? from.variantKey } : measureFromName(from?.name ?? v.name, measures);
    if (found) await db.productVideo.update({ where: { id: v.id }, data: { variantKey: found.key, variantLabel: found.label, variantSource: 'archivo' } });
  }
}

/**
 * La persona elige de qué medida es el video, o que es de todas (null). El
 * clip que salió de ese video queda con la misma, salvo que alguien le haya
 * elegido otra.
 */
export async function setVideoMeasure(db: PrismaClient, args: { accountId: string; videoId: string; variantKey: string | null }): Promise<{ label: string | null }> {
  const video = await db.productVideo.findFirst({ where: { id: args.videoId, product: { accountId: args.accountId } }, select: { id: true, productId: true, edits: { select: { clipId: true } } } });
  if (!video) throw new VideoMeasureError('El video no es de esta cuenta.');
  const measures = await productMeasures(db, video.productId);
  const measure = args.variantKey === null ? null : measures.find((m) => m.key === args.variantKey);
  if (measure === undefined) throw new VideoMeasureError(`Esa medida no está en la ficha del producto. Medidas: ${measures.map((m) => m.label).join(', ') || 'ninguna'}.`);
  const data = { variantKey: measure?.key ?? null, variantLabel: measure?.label ?? null, variantSource: 'persona' };
  const clips = video.edits.map((e) => e.clipId).filter((id): id is string => id !== null);
  await db.$transaction([
    db.productVideo.update({ where: { id: video.id }, data }),
    db.productVideo.updateMany({ where: { id: { in: clips }, OR: [{ variantSource: null }, { variantSource: 'archivo' }] }, data: { ...data, variantSource: 'archivo' } }),
  ]);
  return { label: measure?.label ?? null };
}

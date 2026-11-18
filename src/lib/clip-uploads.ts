import type { Prisma, PrismaClient } from '@/generated/prisma/client';

// Los clips por subir. Mercado Libre no deja subir clips por programa a un
// vendedor local (responde que la cuenta no tiene permiso), así que se suben
// a mano. Esto junta en una sola lista todo lo que falta subir en la cuenta,
// con el archivo y el lugar de Mercado Libre donde va, y elige solo el clip
// recién aprobado para las publicaciones del producto que no tienen ninguno.

type Db = PrismaClient | Prisma.TransactionClient;

// Las publicaciones donde un clip se puede subir: Mercado Libre solo los acepta en las activas.
const LIVE = { externalId: { not: null }, channelStatus: 'ACTIVE' } as const;

/**
 * El clip aprobado queda elegido en las publicaciones activas del producto que
 * todavía no tienen clip. Las que ya tienen uno no se tocan: ahí decide la
 * persona. Un clip grabado para una medida va solo a las publicaciones de esa
 * medida. Se ofrece una sola vez por clip: si después la persona lo saca de
 * una publicación, no vuelve. Devuelve en cuántas quedó.
 */
export async function chooseApprovedClip(tx: Db, args: { clipId: string; userId: string | null; now?: Date }): Promise<number> {
  const now = args.now ?? new Date();
  await tx.videoEdit.updateMany({ where: { clipId: args.clipId }, data: { clipOfferedAt: now } });
  const clip = await tx.productVideo.findUnique({ where: { id: args.clipId }, select: { id: true, productId: true, goneAt: true, variantKey: true } });
  if (!clip || clip.goneAt) return 0;
  const pubs = await tx.publication.findMany({
    where: { productId: clip.productId, ...LIVE, clips: { none: {} }, ...(clip.variantKey ? { OR: [{ variantKey: clip.variantKey }, { variantKey: null }] } : {}) },
    select: { id: true },
  });
  if (pubs.length === 0) return 0;
  await tx.publicationClip.createMany({
    data: pubs.map((p) => ({ publicationId: p.id, videoId: clip.id, position: 0, chosenById: args.userId, chosenAt: now })),
    skipDuplicates: true,
  });
  return pubs.length;
}

/**
 * Ofrece los clips aprobados de la cuenta que todavía no se ofrecieron: los
 * que se aprobaron antes de que existiera Clips por subir. Los más viejos
 * primero, así el primero que se aprobó es el que queda.
 */
export async function offerApprovedClips(db: PrismaClient, accountId: string, now = new Date()): Promise<number> {
  const edits = await db.videoEdit.findMany({
    where: { status: 'APPROVED', clipOfferedAt: null, clipId: { not: null }, clip: { goneAt: null }, video: { product: { accountId } } },
    orderBy: { reviewedAt: 'asc' },
    select: { clipId: true, reviewedById: true },
  });
  let chosen = 0;
  for (const e of edits) chosen += await db.$transaction((tx) => chooseApprovedClip(tx, { clipId: e.clipId!, userId: e.reviewedById, now }));
  return chosen;
}

export type ClipUpload = {
  publicationId: string;
  videoId: string;
  title: string | null;
  product: string;
  externalId: string;
  // En cuántas publicaciones del producto está elegido: se sube una sola vez.
  publications: number;
  storeName: string;
  // La publicación en el listado del vendedor, donde está la opción de subir el video.
  channelLink: string;
  publicationLink: string | null;
  fileName: string;
  mimeType: string;
  // Baja el archivo del Drive, con la cuenta de Google de la persona.
  downloadLink: string;
  driveLink: string | null;
  durationMs: number | null;
  size: number | null;
  chosenAt: Date;
};

const SELLER_SITE: Record<string, string> = {
  MLA: 'https://www.mercadolibre.com.ar',
  MLB: 'https://www.mercadolivre.com.br',
  MLM: 'https://www.mercadolibre.com.mx',
  MLC: 'https://www.mercadolibre.cl',
  MCO: 'https://www.mercadolibre.com.co',
  MLU: 'https://www.mercadolibre.com.uy',
  MPE: 'https://www.mercadolibre.com.pe',
};

/** El listado de publicaciones del vendedor, ya filtrado por el código. */
export function sellerListingLink(externalId: string): string {
  const site = SELLER_SITE[externalId.slice(0, 3).toUpperCase()] ?? SELLER_SITE.MLA;
  return `${site}/publicaciones/listado?search=${encodeURIComponent(externalId)}`;
}

export const driveDownloadLink = (fileId: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

const pending = (accountId: string) =>
  ({ uploadedAt: null, video: { goneAt: null }, publication: { ...LIVE, product: { accountId } } }) satisfies Prisma.PublicationClipWhereInput;

/**
 * Cuántos clips faltan subir en la cuenta, para el menú. Mercado Libre lleva
 * un video por producto, que se ve en todas sus medidas y formas de cobro: un
 * clip elegido en varias publicaciones del producto es una sola subida.
 */
export async function clipUploadCount(db: Db, accountId: string): Promise<number> {
  return (await db.publicationClip.findMany({ where: pending(accountId), distinct: ['videoId'], select: { videoId: true } })).length;
}

/**
 * Los clips que faltan subir, uno por producto y clip, los más viejos primero.
 * De las publicaciones del producto que lo tienen elegido se muestra una, la
 * que está en el pipeline si hay: en el listado de Mercado Libre cualquiera de
 * ellas lleva a la misma fila, la del producto.
 */
export async function pendingClipUploads(db: Db, accountId: string): Promise<ClipUpload[]> {
  const rows = await db.publicationClip.findMany({
    where: pending(accountId),
    orderBy: [{ chosenAt: 'asc' }, { publicationId: 'asc' }, { position: 'asc' }],
    select: {
      publicationId: true,
      videoId: true,
      chosenAt: true,
      video: { select: { name: true, mimeType: true, driveFileId: true, webViewLink: true, durationMs: true, size: true } },
      publication: { select: { title: true, externalId: true, url: true, pipelineStatus: true, store: { select: { name: true } }, product: { select: { name: true } } } },
    },
  });
  const byVideo = new Map<string, typeof rows>();
  for (const r of rows) byVideo.set(r.videoId, [...(byVideo.get(r.videoId) ?? []), r]);
  return [...byVideo.values()].map((group) => {
    const r = group.find((g) => g.publication.pipelineStatus === 'IN_PIPELINE') ?? group[0];
    return {
      publicationId: r.publicationId,
      videoId: r.videoId,
      title: r.publication.title,
      product: r.publication.product.name,
      externalId: r.publication.externalId!,
      publications: group.length,
      storeName: r.publication.store.name,
      channelLink: sellerListingLink(r.publication.externalId!),
      publicationLink: r.publication.url,
      fileName: r.video.name,
      mimeType: r.video.mimeType,
      downloadLink: driveDownloadLink(r.video.driveFileId),
      driveLink: r.video.webViewLink,
      durationMs: r.video.durationMs,
      size: r.video.size === null ? null : Number(r.video.size),
      chosenAt: group[0].chosenAt,
    };
  });
}

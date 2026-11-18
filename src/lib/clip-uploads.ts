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
 * El clip recién aprobado queda elegido en las publicaciones activas del
 * producto que todavía no tienen clip. Las que ya tienen uno no se tocan: ahí
 * decide la persona. Devuelve en cuántas quedó.
 */
export async function chooseApprovedClip(tx: Db, args: { clipId: string; userId: string | null; now?: Date }): Promise<number> {
  const clip = await tx.productVideo.findUnique({ where: { id: args.clipId }, select: { id: true, productId: true, goneAt: true } });
  if (!clip || clip.goneAt) return 0;
  const pubs = await tx.publication.findMany({ where: { productId: clip.productId, ...LIVE, clips: { none: {} } }, select: { id: true } });
  if (pubs.length === 0) return 0;
  await tx.publicationClip.createMany({
    data: pubs.map((p) => ({ publicationId: p.id, videoId: clip.id, position: 0, chosenById: args.userId, chosenAt: args.now ?? new Date() })),
    skipDuplicates: true,
  });
  return pubs.length;
}

export type ClipUpload = {
  publicationId: string;
  videoId: string;
  title: string | null;
  product: string;
  externalId: string;
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

/** Cuántos clips faltan subir en la cuenta, para el menú. */
export function clipUploadCount(db: Db, accountId: string): Promise<number> {
  return db.publicationClip.count({ where: pending(accountId) });
}

/** Los clips elegidos que faltan subir, de las publicaciones activas, los más viejos primero. */
export async function pendingClipUploads(db: Db, accountId: string): Promise<ClipUpload[]> {
  const rows = await db.publicationClip.findMany({
    where: pending(accountId),
    orderBy: [{ chosenAt: 'asc' }, { publicationId: 'asc' }, { position: 'asc' }],
    select: {
      publicationId: true,
      videoId: true,
      chosenAt: true,
      video: { select: { name: true, mimeType: true, driveFileId: true, webViewLink: true, durationMs: true, size: true } },
      publication: { select: { title: true, externalId: true, url: true, store: { select: { name: true } }, product: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    publicationId: r.publicationId,
    videoId: r.videoId,
    title: r.publication.title,
    product: r.publication.product.name,
    externalId: r.publication.externalId!,
    storeName: r.publication.store.name,
    channelLink: sellerListingLink(r.publication.externalId!),
    publicationLink: r.publication.url,
    fileName: r.video.name,
    mimeType: r.video.mimeType,
    downloadLink: driveDownloadLink(r.video.driveFileId),
    driveLink: r.video.webViewLink,
    durationMs: r.video.durationMs,
    size: r.video.size === null ? null : Number(r.video.size),
    chosenAt: r.chosenAt,
  }));
}

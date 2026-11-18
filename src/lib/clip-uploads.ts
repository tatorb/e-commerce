import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { measuresOf } from '@/lib/media';
import { findVideoMeasures } from '@/lib/video-measure';

// Los clips por subir. Mercado Libre no deja subir clips por programa a un
// vendedor local (responde que la cuenta no tiene permiso), así que se suben
// a mano. Esto junta en una sola lista todo lo que falta subir en la cuenta,
// con el archivo y el lugar de Mercado Libre donde va, y elige solo el clip
// recién aprobado para las publicaciones del producto que no tienen ninguno.

type Db = PrismaClient | Prisma.TransactionClient;

// Las publicaciones donde un clip se puede subir: Mercado Libre solo los acepta en las activas.
const LIVE = { externalId: { not: null }, channelStatus: 'ACTIVE' } as const;

/**
 * El clip aprobado queda elegido en las publicaciones activas del producto.
 * Se ofrece una sola vez por clip: si después la persona lo saca de una
 * publicación, no vuelve. Devuelve en cuántas quedó.
 *
 * - Un clip sin medida, que es de todas, va a las publicaciones que todavía
 *   no tienen clip. Las que ya tienen uno no se tocan: ahí decide la persona.
 * - Un clip de una medida va a las publicaciones de esa medida, y ahí
 *   reemplaza al que no era de esa medida. Mientras las otras medidas no
 *   tengan su video, también va en ellas. Así, con un solo video aprobado se
 *   ve en todas, y al aprobar el de otra medida cada uno queda en la suya.
 */
export async function chooseApprovedClip(tx: Db, args: { clipId: string; userId: string | null; now?: Date }): Promise<number> {
  const now = args.now ?? new Date();
  await tx.videoEdit.updateMany({ where: { clipId: args.clipId }, data: { clipOfferedAt: now } });
  const before = await tx.productVideo.findUnique({ where: { id: args.clipId }, select: { productId: true, goneAt: true } });
  if (!before || before.goneAt) return 0;
  await findVideoMeasures(tx, before.productId);
  const clip = await tx.productVideo.findUniqueOrThrow({ where: { id: args.clipId }, select: { id: true, productId: true, variantKey: true } });
  const add = (ids: string[]) =>
    tx.publicationClip.createMany({ data: ids.map((publicationId) => ({ publicationId, videoId: clip.id, position: 0, chosenById: args.userId, chosenAt: now })), skipDuplicates: true });

  if (!clip.variantKey) {
    const pubs = await tx.publication.findMany({ where: { productId: clip.productId, ...LIVE, clips: { none: {} } }, select: { id: true } });
    if (pubs.length > 0) await add(pubs.map((p) => p.id));
    return pubs.length;
  }
  const own = (await tx.publication.findMany({ where: { productId: clip.productId, ...LIVE, variantKey: clip.variantKey }, select: { id: true } })).map((p) => p.id);
  // En su medida, este clip reemplaza al que era de otra o de todas.
  if (own.length > 0) {
    await tx.publicationClip.deleteMany({ where: { publicationId: { in: own }, videoId: { not: clip.id }, video: { OR: [{ variantKey: null }, { variantKey: { not: clip.variantKey } }] } } });
  }
  // Y mientras las otras medidas no tengan su video, también va en ellas.
  const empty = (await tx.publication.findMany({ where: { productId: clip.productId, ...LIVE, id: { notIn: own }, clips: { none: {} } }, select: { id: true } })).map((p) => p.id);
  await add([...own, ...empty]);
  return own.length + empty.length;
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
  // Si el clip va en todas las medidas del producto, o solo en la de esta publicación.
  allMeasures: boolean;
  // La medida, cuando va en una sola.
  measure: string | null;
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
  // La cola de subida: si está pedido, cuándo, y por qué falló la última vez.
  queuedAt: Date | null;
  attempts: number;
  triedAt: Date | null;
  error: string | null;
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
 * Los clips que faltan subir, los más viejos primero. Mercado Libre lleva el
 * video por producto y deja mostrarlo en todas sus medidas o en una sola:
 * - un clip elegido en todas las medidas activas del producto es una sola
 *   subida, para todas;
 * - un clip elegido solo en algunas es una subida por medida.
 * Las formas de cobro de una medida comparten el video. De las publicaciones
 * de cada grupo se muestra una, la que está en el pipeline si hay.
 * Con `productId`, solo los de ese producto.
 */
export async function pendingClipUploads(db: Db, accountId: string, productId?: string): Promise<ClipUpload[]> {
  const rows = await db.publicationClip.findMany({
    where: { ...pending(accountId), ...(productId ? { publication: { ...LIVE, productId, product: { accountId } } } : {}) },
    orderBy: [{ chosenAt: 'asc' }, { publicationId: 'asc' }, { position: 'asc' }],
    select: {
      publicationId: true,
      videoId: true,
      chosenAt: true,
      uploadAskedAt: true,
      uploadTriedAt: true,
      uploadAttempts: true,
      uploadError: true,
      video: { select: { name: true, mimeType: true, driveFileId: true, webViewLink: true, durationMs: true, size: true } },
      publication: {
        select: { title: true, externalId: true, url: true, pipelineStatus: true, variantKey: true, productId: true,
          store: { select: { name: true } },
          product: { select: { name: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
        },
      },
    },
  });
  if (rows.length === 0) return [];
  // Las medidas activas de cada producto, para saber si un clip las cubre todas.
  const live = await db.publication.findMany({
    where: { ...LIVE, productId: { in: [...new Set(rows.map((r) => r.publication.productId))] } },
    select: { productId: true, variantKey: true },
  });
  const liveMeasures = new Map<string, Set<string | null>>();
  for (const p of live) liveMeasures.set(p.productId, (liveMeasures.get(p.productId) ?? new Set()).add(p.variantKey));

  const byVideo = new Map<string, typeof rows>();
  for (const r of rows) byVideo.set(r.videoId, [...(byVideo.get(r.videoId) ?? []), r]);
  const out: ClipUpload[] = [];
  for (const group of byVideo.values()) {
    const all = liveMeasures.get(group[0].publication.productId) ?? new Set();
    const labels = measuresOf(group[0].publication.product.variants);
    const chosen = new Set(group.map((g) => g.publication.variantKey));
    const covers = [...all].every((m) => chosen.has(m));
    // Para todas las medidas, una fila; si no, una por medida.
    const parts = covers ? [group] : [...chosen].map((m) => group.filter((g) => g.publication.variantKey === m));
    for (const part of parts) {
      const r = part.find((g) => g.publication.pipelineStatus === 'IN_PIPELINE') ?? part[0];
      out.push({
        publicationId: r.publicationId,
        videoId: r.videoId,
        title: r.publication.title,
        product: r.publication.product.name,
        externalId: r.publication.externalId!,
        publications: part.length,
        allMeasures: covers,
        measure: covers ? null : (labels.find((m) => m.key === r.publication.variantKey)?.label ?? null),
        storeName: r.publication.store.name,
        channelLink: sellerListingLink(r.publication.externalId!),
        publicationLink: r.publication.url,
        fileName: r.video.name,
        mimeType: r.video.mimeType,
        downloadLink: driveDownloadLink(r.video.driveFileId),
        driveLink: r.video.webViewLink,
        durationMs: r.video.durationMs,
        size: r.video.size === null ? null : Number(r.video.size),
        chosenAt: part[0].chosenAt,
        queuedAt: part.find((g) => g.uploadAskedAt)?.uploadAskedAt ?? null,
        attempts: Math.max(...part.map((g) => g.uploadAttempts)),
        triedAt: part.find((g) => g.uploadTriedAt)?.uploadTriedAt ?? null,
        error: part.find((g) => g.uploadError)?.uploadError ?? null,
      });
    }
  }
  return out.sort((x, y) => x.chosenAt.getTime() - y.chosenAt.getTime());
}

/** Cuántos clips faltan subir en la cuenta. */
export async function clipUploadCount(db: Db, accountId: string): Promise<number> {
  return (await pendingClipUploads(db, accountId)).length;
}

// ───────────────────────────── La cola de subida ─────────────────────────────

// Cuántas veces la extensión intenta un clip, y cuánto se espera a que termine
// antes de darlo por colgado y tomarlo de nuevo.
export const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_LEASE_MS = 15 * 60_000;
// La pausa entre una subida y la siguiente: de a una y sin apuro.
export const UPLOAD_PAUSE_S = 120;
// Una extensión que no pregunta hace más que esto no está atendiendo la cola.
const UPLOADER_ALIVE_MS = 5 * 60_000;

/** Las filas de la base de una subida: las publicaciones del producto, o de la medida, que tienen ese clip sin subir. */
async function rowsOf(db: Db, accountId: string, u: { publicationId: string; videoId: string; allMeasures: boolean }) {
  const pub = await db.publication.findFirst({ where: { id: u.publicationId, product: { accountId } }, select: { productId: true, variantKey: true } });
  if (!pub) return null;
  return { videoId: u.videoId, uploadedAt: null, publication: { productId: pub.productId, ...(u.allMeasures ? {} : { variantKey: pub.variantKey }) } } satisfies Prisma.PublicationClipWhereInput;
}

/**
 * Pone clips en la cola de subida, o los saca. Sin `items`, todos los que
 * faltan subir en la cuenta. Devuelve cuántos quedaron pedidos.
 */
export async function queueClipUploads(
  db: PrismaClient,
  args: { accountId: string; items?: { publicationId: string; videoId: string }[]; queued: boolean; now?: Date },
): Promise<{ changed: number; skipped: { publicationId: string; videoId: string }[] }> {
  const pendings = await pendingClipUploads(db, args.accountId);
  const skipped: { publicationId: string; videoId: string }[] = [];
  let targets = pendings;
  if (args.items) {
    targets = [];
    for (const item of args.items) {
      // La publicación puede ser cualquiera de las del producto, o de la medida, que tienen el clip.
      const pub = await db.publication.findFirst({ where: { id: item.publicationId, product: { accountId: args.accountId } }, select: { productId: true, variantKey: true } });
      const reps = pub ? await db.publication.findMany({ where: { id: { in: pendings.filter((p) => p.videoId === item.videoId).map((p) => p.publicationId) }, productId: pub.productId }, select: { id: true, variantKey: true } }) : [];
      const hit = pendings.find((p) => p.videoId === item.videoId && reps.some((r) => r.id === p.publicationId && (p.allMeasures || r.variantKey === pub!.variantKey)));
      if (hit) targets.push(hit);
      else skipped.push(item);
    }
  }
  let changed = 0;
  for (const u of targets) {
    const where = await rowsOf(db, args.accountId, u);
    if (!where) continue;
    await db.publicationClip.updateMany({
      where,
      data: args.queued ? { uploadAskedAt: args.now ?? new Date(), uploadTriedAt: null, uploadAttempts: 0, uploadError: null } : { uploadAskedAt: null, uploadTriedAt: null },
    });
    changed += 1;
  }
  return { changed, skipped };
}

export type QueuedUpload = Pick<ClipUpload, 'publicationId' | 'videoId' | 'externalId' | 'fileName' | 'mimeType' | 'allMeasures'> & { accountSlug: string };

/**
 * La extensión pregunta si hay un clip para subir, entre las cuentas que ve la
 * persona. Toma el más viejo de la cola, lo anota como en curso y lo devuelve.
 * Uno que se intentó demasiadas veces sale de la cola con su aviso.
 */
export async function claimQueuedUpload(db: PrismaClient, accounts: { id: string; slug: string }[], now = new Date()): Promise<QueuedUpload | null> {
  for (const account of accounts) {
    const queue = (await pendingClipUploads(db, account.id)).filter((u) => u.queuedAt).sort((a, b) => a.queuedAt!.getTime() - b.queuedAt!.getTime());
    for (const u of queue) {
      // Otra pestaña o el intento anterior lo tienen todavía.
      if (u.triedAt && now.getTime() - u.triedAt.getTime() < UPLOAD_LEASE_MS) return null;
      const where = await rowsOf(db, account.id, u);
      if (!where) continue;
      if (u.attempts >= UPLOAD_MAX_ATTEMPTS) {
        await db.publicationClip.updateMany({ where, data: { uploadAskedAt: null, uploadTriedAt: null, uploadError: `La extensión empezó esta subida ${UPLOAD_MAX_ATTEMPTS} veces y no la terminó. Puede que se haya cerrado Chrome.` } });
        continue;
      }
      await db.publicationClip.updateMany({ where, data: { uploadTriedAt: now, uploadAttempts: { increment: 1 } } });
      return { publicationId: u.publicationId, videoId: u.videoId, externalId: u.externalId, fileName: u.fileName, mimeType: u.mimeType, allMeasures: u.allMeasures, accountSlug: account.slug };
    }
  }
  return null;
}

/** La extensión cuenta cómo salió: subido queda anotado; si falló, sale de la cola con el motivo. */
export async function finishQueuedUpload(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; videoId: string; allMeasures: boolean; ok: boolean; error?: string | null; userId: string | null; now?: Date },
): Promise<void> {
  const where = await rowsOf(db, args.accountId, args);
  if (!where) return;
  if (args.ok) {
    await db.publicationClip.updateMany({ where, data: { uploadedAt: args.now ?? new Date(), uploadedById: args.userId, uploadAskedAt: null, uploadTriedAt: null, uploadError: null } });
    return;
  }
  await db.publicationClip.updateMany({ where, data: { uploadAskedAt: null, uploadTriedAt: null, uploadError: (args.error ?? 'La extensión no pudo subirlo.').slice(0, 500) } });
}

/** La extensión avisa que está viva, y si tiene prendido subir sola la cola. */
export async function uploaderSeen(db: PrismaClient, args: { userId: string; version: string | null; auto: boolean; now?: Date }): Promise<void> {
  const data = { seenAt: args.now ?? new Date(), version: args.version?.slice(0, 20) ?? null, auto: args.auto };
  await db.clipUploader.upsert({ where: { userId: args.userId }, create: { userId: args.userId, ...data }, update: data });
}

/** Quién está atendiendo la cola ahora: las extensiones que preguntaron hace poco con la cola prendida. */
export async function activeUploaders(db: Db, now = new Date()): Promise<{ name: string; seenAt: Date; version: string | null }[]> {
  const rows = await db.clipUploader.findMany({ where: { auto: true, seenAt: { gte: new Date(now.getTime() - UPLOADER_ALIVE_MS) } }, orderBy: { seenAt: 'desc' }, select: { seenAt: true, version: true, user: { select: { name: true } } } });
  return rows.map((r) => ({ name: r.user.name, seenAt: r.seenAt, version: r.version }));
}

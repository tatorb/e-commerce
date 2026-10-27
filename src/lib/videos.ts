import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { videoUploadType } from '@/domain/videos';
import { shotText } from '@/domain/shoot';
import {
  DriveError,
  driveEmail,
  ensureFolder,
  folderUrl,
  getFile,
  knownFolderId,
  listFiles,
  startResumableUpload,
  trashFile,
  videosFolder,
  withDriveToken,
  type DriveFile,
} from '@/lib/drive';

// Los videos de cada producto, guardados en su carpeta del Drive, y el clip
// elegido para cada publicación. La app guarda solo los datos de cada video:
// el archivo vive en el Drive y se puede agregar, cambiar o borrar desde la
// Mac. Recibe la base por parámetro para poder probarlo con una base de prueba
// y un Google simulado.

export class VideoError extends Error {}

// Quién lo midió: el navegador ve el video como se muestra, con el giro del
// teléfono ya aplicado. Lo que informa Google queda hasta que lo mida.
export const BY_BROWSER = 'navegador';
const BY_DRIVE = 'drive';

async function productFor(db: PrismaClient, accountId: string, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, accountId },
    select: { id: true, name: true, account: { select: { id: true, name: true } } },
  });
  if (!product) throw new VideoError('El producto no es de esta cuenta.');
  return product;
}

/** Los datos de un archivo del Drive como los guarda la app. */
export function videoData(f: DriveFile) {
  const m = f.videoMediaMetadata;
  const duration = Number(m?.durationMillis);
  return {
    name: f.name,
    mimeType: f.mimeType,
    size: f.size && /^\d+$/.test(f.size) ? BigInt(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    driveCreatedAt: f.createdTime ? new Date(f.createdTime) : null,
    // Google lo informa cuando termina de procesar el video.
    measure: m?.width && m?.height && Number.isFinite(duration) && duration > 0 ? { width: m.width, height: m.height, durationMs: Math.round(duration) } : null,
  };
}

const videosQuery = (folderId: string) => `'${folderId}' in parents and trashed=false and mimeType contains 'video/'`;

export type SyncResult = { folderId: string; folderUrl: string; added: number; gone: number; updated: number };

/**
 * Lee la carpeta de videos del producto y pone al día la lista: suma los que
 * se agregaron desde el Drive, marca los que se borraron o se movieron y
 * anota las medidas que informa Google. Crea la carpeta si no está.
 */
export async function syncProductVideos(db: PrismaClient, args: { accountId: string; productId: string; now?: Date }): Promise<SyncResult> {
  const now = args.now ?? new Date();
  const product = await productFor(db, args.accountId, args.productId);
  return withDriveToken(db, async (token, email) => {
    const folderId = await ensureFolder(db, token, email, videosFolder(product.account, product));
    const files = await listFiles(token, videosQuery(folderId));
    const known = await db.productVideo.findMany({
      where: { OR: [{ productId: product.id }, { driveFileId: { in: files.map((f) => f.id) } }] },
    });
    const byFile = new Map(known.map((v) => [v.driveFileId, v]));
    let added = 0;
    let updated = 0;

    const fresh = files.filter((f) => !byFile.has(f.id));
    if (fresh.length > 0) {
      const r = await db.productVideo.createMany({
        data: fresh.map((f) => {
          const d = videoData(f);
          return {
            productId: product.id,
            driveFileId: f.id,
            name: d.name,
            mimeType: d.mimeType,
            size: d.size,
            webViewLink: d.webViewLink,
            driveCreatedAt: d.driveCreatedAt,
            origin: 'DRIVE' as const,
            ...(d.measure ? { ...d.measure, measuredBy: BY_DRIVE } : {}),
          };
        }),
        skipDuplicates: true,
      });
      added = r.count;
    }

    for (const f of files) {
      const row = byFile.get(f.id);
      if (!row) continue;
      const d = videoData(f);
      const takeMeasure = d.measure !== null && row.measuredBy !== BY_BROWSER;
      const changed =
        row.productId !== product.id ||
        row.name !== d.name ||
        row.mimeType !== d.mimeType ||
        row.size !== d.size ||
        row.webViewLink !== d.webViewLink ||
        row.goneAt !== null ||
        (takeMeasure && (row.width !== d.measure!.width || row.height !== d.measure!.height || row.durationMs !== d.measure!.durationMs));
      if (!changed) continue;
      await db.productVideo.update({
        where: { id: row.id },
        data: {
          // Si lo movieron desde la carpeta de otro producto, pasa a este.
          productId: product.id,
          name: d.name,
          mimeType: d.mimeType,
          size: d.size,
          webViewLink: d.webViewLink,
          goneAt: null,
          ...(takeMeasure ? { ...d.measure!, measuredBy: BY_DRIVE } : {}),
        },
      });
      updated++;
    }

    const listed = new Set(files.map((f) => f.id));
    const goneIds = known.filter((v) => v.productId === product.id && v.goneAt === null && !listed.has(v.driveFileId)).map((v) => v.id);
    if (goneIds.length > 0) await db.productVideo.updateMany({ where: { id: { in: goneIds } }, data: { goneAt: now } });
    return { folderId, folderUrl: folderUrl(folderId), added, gone: goneIds.length, updated };
  });
}

/** Abre la subida de un video a la carpeta del producto. El navegador sube el archivo directo a Google. */
export async function startVideoUpload(
  db: PrismaClient,
  args: { accountId: string; productId: string; file: { name: string; size: number; type: string }; origin: string },
): Promise<{ uploadUrl: string }> {
  const product = await productFor(db, args.accountId, args.productId);
  const name = args.file.name.trim().slice(0, 200);
  const check = videoUploadType({ name, size: args.file.size, type: args.file.type });
  if (!check.ok) throw new VideoError(check.error);
  return withDriveToken(db, async (token, email) => {
    const folderId = await ensureFolder(db, token, email, videosFolder(product.account, product));
    const uploadUrl = await startResumableUpload(token, {
      folderId,
      name,
      type: check.type,
      size: args.file.size,
      origin: args.origin,
      properties: { mrbProducto: product.id },
    });
    return { uploadUrl };
  });
}

export type BrowserMeasure = { width: number; height: number; durationMs: number };

/** Si las medidas que mandó el navegador tienen sentido. */
export function validMeasure(m: unknown): BrowserMeasure | null {
  if (!m || typeof m !== 'object') return null;
  const { width, height, durationMs } = m as Record<string, unknown>;
  const ok = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= max;
  return ok(width, 20_000) && ok(height, 20_000) && ok(durationMs, 24 * 3600_000) ? { width, height, durationMs } : null;
}

/**
 * Anota el video que terminó de subir el navegador. Confirma con Google que
 * esté en la carpeta del producto y que haya llegado entero; si llegó
 * incompleto, lo manda a la papelera.
 */
export async function finishVideoUpload(
  db: PrismaClient,
  args: { accountId: string; productId: string; fileId: string; size: number; measure: unknown; userId: string | null },
): Promise<{ videoId: string }> {
  const product = await productFor(db, args.accountId, args.productId);
  const measure = validMeasure(args.measure);
  return withDriveToken(db, async (token, email) => {
    const folderId = await knownFolderId(db, `videos:${product.id}`, email);
    const file = await getFile(token, args.fileId);
    if (!file || file.trashed || !folderId || !file.parents?.includes(folderId)) {
      throw new VideoError('El video no quedó en la carpeta del producto. Probá de nuevo.');
    }
    const d = videoData(file);
    if (d.size !== null && d.size !== BigInt(args.size)) {
      await trashFile(token, file.id).catch(() => undefined);
      throw new VideoError('El video llegó incompleto al Drive. Probá de nuevo.');
    }
    const fields = {
      productId: product.id,
      name: d.name,
      mimeType: d.mimeType,
      size: d.size,
      webViewLink: d.webViewLink,
      driveCreatedAt: d.driveCreatedAt,
      origin: 'APP' as const,
      uploadedById: args.userId,
      goneAt: null,
      ...(measure ? { ...measure, measuredBy: BY_BROWSER } : d.measure ? { ...d.measure, measuredBy: BY_DRIVE } : {}),
    };
    const row = await db.productVideo.upsert({
      where: { driveFileId: file.id },
      create: { driveFileId: file.id, ...fields },
      update: fields,
    });
    return { videoId: row.id };
  });
}

async function videoFor(db: PrismaClient, accountId: string, videoId: string) {
  const video = await db.productVideo.findFirst({ where: { id: videoId, product: { accountId } } });
  if (!video) throw new VideoError('El video no es de esta cuenta.');
  return video;
}

/** Guarda las medidas que tomó el navegador al reproducir el video. */
export async function saveVideoMeasure(db: PrismaClient, args: { accountId: string; videoId: string; measure: unknown }): Promise<boolean> {
  const video = await videoFor(db, args.accountId, args.videoId);
  const measure = validMeasure(args.measure);
  if (!measure) return false;
  if (video.measuredBy === BY_BROWSER && video.width === measure.width && video.height === measure.height && video.durationMs === measure.durationMs) {
    return false;
  }
  await db.productVideo.update({ where: { id: video.id }, data: { ...measure, measuredBy: BY_BROWSER } });
  return true;
}

/** Manda el video a la papelera del Drive: se puede recuperar desde ahí durante 30 días. */
export async function trashVideo(db: PrismaClient, args: { accountId: string; videoId: string; now?: Date }): Promise<void> {
  const video = await videoFor(db, args.accountId, args.videoId);
  await withDriveToken(db, async (token) => {
    try {
      await trashFile(token, video.driveFileId);
    } catch (e) {
      // Ya no estaba.
      if (!(e instanceof DriveError && e.status === 404)) throw e;
    }
  });
  await db.productVideo.update({ where: { id: video.id }, data: { goneAt: args.now ?? new Date() } });
}

async function publicationFor(db: PrismaClient | Prisma.TransactionClient, accountId: string, publicationId: string) {
  const pub = await db.publication.findFirst({ where: { id: publicationId, product: { accountId } }, select: { id: true, productId: true } });
  if (!pub) throw new VideoError('La publicación no es de esta cuenta.');
  return pub;
}

/**
 * Suma un clip a la publicación, entre los videos de su producto. Va al final:
 * el orden es en el que se suben. Si ya estaba, no cambia.
 */
export async function chooseClip(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; videoId: string; userId: string | null; now?: Date },
): Promise<void> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const video = await db.productVideo.findFirst({ where: { id: args.videoId, productId: pub.productId, goneAt: null } });
  if (!video) throw new VideoError('El video no está entre los del producto.');
  const key = { publicationId_videoId: { publicationId: pub.id, videoId: video.id } };
  if (await db.publicationClip.findUnique({ where: key })) return;
  const last = await db.publicationClip.aggregate({ where: { publicationId: pub.id }, _max: { position: true } });
  await db.publicationClip.create({
    data: { publicationId: pub.id, videoId: video.id, position: (last._max.position ?? -1) + 1, chosenById: args.userId, chosenAt: args.now ?? new Date() },
  });
}

/**
 * Deja como clips de la publicación esos videos, en ese orden. Los que ya
 * estaban conservan su marca de subido; los nuevos tienen que estar en el Drive.
 */
export async function setClips(
  db: PrismaClient | Prisma.TransactionClient,
  args: { accountId: string; publicationId: string; videoIds: string[]; userId: string | null; now?: Date },
): Promise<void> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const ids = [...new Set(args.videoIds)];
  const [videos, current] = await Promise.all([
    db.productVideo.findMany({ where: { id: { in: ids }, productId: pub.productId }, select: { id: true, goneAt: true } }),
    db.publicationClip.findMany({ where: { publicationId: pub.id }, select: { videoId: true } }),
  ]);
  const had = new Set(current.map((c) => c.videoId));
  for (const id of ids) {
    const video = videos.find((v) => v.id === id);
    if (!video || (video.goneAt && !had.has(id))) throw new VideoError('Uno de los videos ya no está entre los del producto. Recargá la página.');
  }
  await db.publicationClip.deleteMany({ where: { publicationId: pub.id, videoId: { notIn: ids } } });
  for (const [position, videoId] of ids.entries()) {
    await db.publicationClip.upsert({
      where: { publicationId_videoId: { publicationId: pub.id, videoId } },
      create: { publicationId: pub.id, videoId, position, chosenById: args.userId, chosenAt: args.now ?? new Date() },
      update: { position },
    });
  }
}

/** Saca un clip de la publicación. El video sigue entre los del producto. */
export async function removeClip(db: PrismaClient, args: { accountId: string; publicationId: string; videoId: string }): Promise<void> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  await db.publicationClip.deleteMany({ where: { publicationId: pub.id, videoId: args.videoId } });
}

/** Cambia de lugar un clip: by -1 lo sube, 1 lo baja. */
export async function moveClip(db: PrismaClient, args: { accountId: string; publicationId: string; videoId: string; by: number }): Promise<void> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  await db.$transaction(async (tx) => {
    const clips = await tx.publicationClip.findMany({ where: { publicationId: pub.id }, orderBy: [{ position: 'asc' }, { chosenAt: 'asc' }], select: { videoId: true } });
    const order = clips.map((c) => c.videoId);
    const from = order.indexOf(args.videoId);
    if (from < 0) throw new VideoError('Ese video ya no es un clip de la publicación.');
    const to = Math.max(0, Math.min(order.length - 1, from + Math.sign(args.by)));
    order.splice(to, 0, ...order.splice(from, 1));
    for (const [position, videoId] of order.entries()) {
      await tx.publicationClip.update({ where: { publicationId_videoId: { publicationId: pub.id, videoId } }, data: { position } });
    }
  });
}

/** Anota que un clip ya se subió a mano al canal, o lo desmarca. */
export async function markClipUploaded(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; videoId: string; uploaded: boolean; userId: string | null; now?: Date },
): Promise<void> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const r = await db.publicationClip.updateMany({
    where: { publicationId: pub.id, videoId: args.videoId },
    data: args.uploaded ? { uploadedAt: args.now ?? new Date(), uploadedById: args.userId } : { uploadedAt: null, uploadedById: null },
  });
  if (r.count === 0) throw new VideoError('Primero elegí el clip.');
}

export type VideoRow = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  measuredByBrowser: boolean;
  webViewLink: string | null;
  origin: 'APP' | 'DRIVE';
  uploadedBy: string | null;
  createdAt: Date;
  gone: boolean;
  // Grabado en Registro de productos: la medida y el paso.
  shot: string | null;
};

/** Lo que muestra el paso Videos: los videos del producto, el clip de la publicación y la conexión con el Drive. */
export async function loadVideosStep(db: PrismaClient, args: { accountId: string; publicationId: string }) {
  const pub = await db.publication.findFirstOrThrow({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: {
      productId: true,
      channelCopy: { select: { hasVideo: true, readAt: true } },
      clips: {
        orderBy: [{ position: 'asc' }, { chosenAt: 'asc' }],
        select: {
          videoId: true,
          chosenAt: true,
          uploadedAt: true,
          chosenBy: { select: { name: true } },
          uploadedBy: { select: { name: true } },
        },
      },
      store: { select: { channel: { select: { kind: true, name: true } } } },
    },
  });
  const [email, rows, sharedWith] = await Promise.all([
    driveEmail(db),
    db.productVideo.findMany({
      where: { productId: pub.productId, OR: [{ goneAt: null }, { clips: { some: { publicationId: args.publicationId } } }] },
      orderBy: [{ driveCreatedAt: 'asc' }, { createdAt: 'asc' }],
      include: { uploadedBy: { select: { name: true } }, shootStep: { select: { title: true } } },
    }),
    db.publication.count({ where: { productId: pub.productId } }),
  ]);
  const folderId = email ? await knownFolderId(db, `videos:${pub.productId}`, email) : null;
  const videos: VideoRow[] = rows.map((v) => ({
    id: v.id,
    name: v.name,
    mimeType: v.mimeType,
    size: v.size === null ? null : Number(v.size),
    width: v.width,
    height: v.height,
    durationMs: v.durationMs,
    measuredByBrowser: v.measuredBy === BY_BROWSER,
    webViewLink: v.webViewLink,
    origin: v.origin,
    uploadedBy: v.uploadedBy?.name ?? null,
    createdAt: v.driveCreatedAt ?? v.createdAt,
    gone: v.goneAt !== null,
    shot: v.shot ? shotText(v.variantLabel, v.shootStep?.title ?? null) : null,
  }));
  return {
    productId: pub.productId,
    driveEmail: email,
    folderUrl: folderId ? folderUrl(folderId) : null,
    videos,
    // Los clips de la publicación, en el orden en que se suben.
    clips: pub.clips.map((c) => ({
      videoId: c.videoId,
      chosenAt: c.chosenAt,
      chosenBy: c.chosenBy?.name ?? null,
      uploadedAt: c.uploadedAt,
      uploadedBy: c.uploadedBy?.name ?? null,
    })),
    channel: pub.store.channel,
    // Lo que dijo el canal en la última lectura.
    channelHasVideo: pub.channelCopy ? pub.channelCopy.hasVideo : null,
    sharedWith,
  };
}

export type VideosStepData = Awaited<ReturnType<typeof loadVideosStep>>;

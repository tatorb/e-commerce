import { del, list } from '@vercel/blob';
import type { PrismaClient } from '@/generated/prisma/client';
import type { UploadKind } from '@/domain/photo-contract';
import { driveRef, ensureFolder, folderOwner, manufacturerFolder, photoFolder, trashFile, uploadContent, withDriveToken, type FolderOwner, type PhotoFolder } from './drive';
import { FileError, readBlob } from './files';
import { outputName, outputType, syncCorrected } from './photo-files';

// Pasa al Drive del estudio lo que quedó guardado en el depósito de Vercel de
// antes: originales, vistas, siluetas y finales de la línea de imágenes, y los
// archivos del fabricante. De a uno, con un tope de tiempo por tanda: la
// pantalla pide tandas hasta que no queda nada. No borra nada de Vercel; eso
// se hace aparte, cuando ya está todo en el Drive. Recibe la base por
// parámetro para poder probarlo.

const IN_DRIVE = 'drive:';
const notInDrive = { not: { startsWith: IN_DRIVE } };

/** Cuántos archivos quedan en Vercel. */
export async function vercelLeft(db: PrismaClient): Promise<number> {
  const counts = await Promise.all([
    db.productFile.count({ where: { url: notInDrive } }),
    db.photoEdit.count({ where: { originalUrl: notInDrive } }),
    db.photoEdit.count({ where: { previewUrl: notInDrive } }),
    db.photoStepRun.count({ where: { previewUrl: notInDrive } }),
    db.photoStepRun.count({ where: { maskUrl: notInDrive } }),
    db.photoStepRun.count({ where: { pngUrl: notInDrive } }),
    db.photoStepRun.count({ where: { jpgUrl: notInDrive } }),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

// Un archivo para pasar: dónde está, a qué carpeta va, con qué nombre y marca,
// y cómo se anota en la base que ya pasó. Si en el medio cambió, no se anota.
type Item = {
  url: string;
  productId: string;
  folder: PhotoFolder | 'fabricante';
  name: string;
  type: string;
  properties: Record<string, string>;
  save: (ref: string) => Promise<number>;
};

const RUN_FIELDS: { field: 'previewUrl' | 'maskUrl' | 'pngUrl' | 'jpgUrl'; kind: UploadKind }[] = [
  { field: 'previewUrl', kind: 'vista' },
  { field: 'maskUrl', kind: 'mascara' },
  { field: 'pngUrl', kind: 'png' },
  { field: 'jpgUrl', kind: 'jpg' },
];

/** El próximo archivo que queda en Vercel, saltando los que ya fallaron en esta tanda. */
async function nextItem(db: PrismaClient, skip: Set<string>): Promise<Item | null> {
  const notIn = { notIn: [...skip] };
  const file = await db.productFile.findFirst({ where: { url: { ...notInDrive, ...notIn } }, orderBy: { createdAt: 'asc' } });
  if (file) {
    return {
      url: file.url,
      productId: file.productId,
      folder: 'fabricante',
      name: file.name,
      type: file.contentType,
      properties: { mrbProducto: file.productId },
      save: async (ref) => (await db.productFile.updateMany({ where: { id: file.id, url: file.url }, data: { url: ref } })).count,
    };
  }
  const original = await db.photoEdit.findFirst({ where: { originalUrl: { ...notInDrive, ...notIn } }, orderBy: { createdAt: 'asc' } });
  if (original) {
    return {
      url: original.originalUrl,
      productId: original.productId,
      folder: 'originales',
      name: original.originalName,
      type: original.originalType,
      properties: { mrbProducto: original.productId },
      save: async (ref) =>
        (await db.photoEdit.updateMany({ where: { id: original.id, originalUrl: original.originalUrl }, data: { originalUrl: ref } })).count,
    };
  }
  const before = await db.photoEdit.findFirst({ where: { previewUrl: { ...notInDrive, ...notIn } }, orderBy: { createdAt: 'asc' } });
  if (before?.previewUrl) {
    const url = before.previewUrl;
    return {
      url,
      productId: before.productId,
      folder: 'trabajo',
      name: outputName(before.originalName, before.id, 'antes'),
      type: outputType('antes'),
      properties: { mrbFoto: before.id, mrbTipo: 'antes' },
      save: async (ref) => (await db.photoEdit.updateMany({ where: { id: before.id, previewUrl: url }, data: { previewUrl: ref } })).count,
    };
  }
  for (const { field, kind } of RUN_FIELDS) {
    const run = await db.photoStepRun.findFirst({
      where: { [field]: { ...notInDrive, ...notIn } },
      orderBy: { createdAt: 'asc' },
      include: { edit: { select: { productId: true, originalName: true } } },
    });
    const url = run?.[field];
    if (!run || !url) continue;
    return {
      url,
      productId: run.edit.productId,
      folder: 'trabajo',
      name: outputName(run.edit.originalName, run.id, kind),
      type: outputType(kind),
      // Con la marca de su intento, así las finales aprobadas pasan a Corregidas.
      properties: { mrbCorrida: run.id, mrbTipo: kind },
      save: async (ref) => (await db.photoStepRun.updateMany({ where: { id: run.id, [field]: url }, data: { [field]: ref } })).count,
    };
  }
  return null;
}

export type MoveResult = { moved: number; left: number; problems: string[] };

/** Pasa al Drive todo lo que entre en el tiempo. Lo que no se pudo pasar queda anotado para mostrar. */
export async function moveBatch(db: PrismaClient, opts: { budgetMs: number; now?: () => number }): Promise<MoveResult> {
  const now = opts.now ?? Date.now;
  const until = now() + opts.budgetMs;
  const skip = new Set<string>();
  const problems: string[] = [];
  const touched = new Set<string>();
  const owners = new Map<string, FolderOwner>();
  let moved = 0;
  await withDriveToken(db, async (token, email) => {
    while (now() < until) {
      const item = await nextItem(db, skip);
      if (!item) break;
      try {
        const res = await readBlob(item.url);
        if (!res) throw new FileError(`${item.name}: ya no estaba en Vercel.`);
        const data = await res.arrayBuffer();
        if (!owners.has(item.productId)) owners.set(item.productId, await folderOwner(db, item.productId));
        const owner = owners.get(item.productId)!;
        const spec = item.folder === 'fabricante' ? manufacturerFolder(owner.account, owner.product) : photoFolder(owner.account, owner.product, item.folder);
        const folderId = await ensureFolder(db, token, email, spec);
        const file = await uploadContent(token, { folderId, name: item.name, type: item.type, data, properties: item.properties });
        // Si mientras tanto cambió en la base, la copia no sirve.
        if ((await item.save(driveRef(file.id))) === 0) await trashFile(token, file.id).catch(() => undefined);
        else moved++;
        touched.add(item.productId);
      } catch (e) {
        if (!(e instanceof FileError)) throw e;
        skip.add(item.url);
        problems.push(e.message);
      }
    }
  });
  // Las finales aprobadas que pasaron van a Corregidas.
  for (const productId of touched) {
    await syncCorrected(db, productId).catch((e) => console.error('No se pudo ordenar Corregidas después de pasar al Drive.', e));
  }
  return { moved, left: await vercelLeft(db), problems };
}

/**
 * Borra los archivos del depósito de Vercel, de a tandas. Solo cuando ya está
 * todo en el Drive. Devuelve si quedan más.
 */
export async function deleteVercelBatch(db: PrismaClient, opts: { budgetMs: number; now?: () => number }): Promise<{ deleted: number; more: boolean }> {
  if ((await vercelLeft(db)) > 0) throw new FileError('Todavía quedan archivos para pasar al Drive: primero pasalos.');
  const now = opts.now ?? Date.now;
  const until = now() + opts.budgetMs;
  let deleted = 0;
  for (;;) {
    const page = await list({ limit: 500 });
    if (page.blobs.length === 0) return { deleted, more: false };
    await del(page.blobs.map((b) => b.url));
    deleted += page.blobs.length;
    if (now() >= until) return { deleted, more: page.hasMore };
  }
}

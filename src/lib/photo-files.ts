import type { PrismaClient } from '@/generated/prisma/client';
import type { Transfer, UploadKind } from '@/domain/photo-contract';
import { LAST_PHOTO_STEP } from '@/domain/photo-steps';
import {
  driveQueryValue,
  ensureFolder,
  folderOwner,
  getFile,
  listFiles,
  moveFile,
  photoFolder,
  startResumableUpload,
  trashFile,
  withDriveToken,
  type FolderOwner,
  type PhotoFolder,
} from './drive';
import { driveIdOf, driveRef } from './stored-files';

export { CHANNEL_PHOTO_MAX_BYTES, ORIGINAL_MAX_BYTES, ORIGINAL_TYPES, originalTypeFor } from './photo-rules';

// Los archivos de la línea de imágenes en el Drive del estudio, en la carpeta
// Fotos de cada producto: Originales, Corregidas (las finales aprobadas, con
// el nombre del original) y Trabajo de la app (vistas livianas, siluetas y
// finales sin aprobar). El trabajador sube directo al Drive, cada archivo con
// una subida que sirve solo para ese archivo: la llave del Drive nunca sale
// de la app. Cada archivo lleva la marca de su intento, para encontrarlo.

const OUTPUTS: Record<UploadKind, { label: string; ext: string; contentType: string }> = {
  antes: { label: 'antes', ext: 'jpg', contentType: 'image/jpeg' },
  vista: { label: 'vista', ext: 'jpg', contentType: 'image/jpeg' },
  mascara: { label: 'silueta', ext: 'png', contentType: 'image/png' },
  png: { label: 'corregida', ext: 'png', contentType: 'image/png' },
  jpg: { label: 'corregida', ext: 'jpg', contentType: 'image/jpeg' },
};

export const outputType = (kind: UploadKind) => OUTPUTS[kind].contentType;

/** El nombre del original sin la extensión. */
export const baseName = (name: string) => name.replace(/\.[^.]+$/, '').trim() || 'foto';

/** "IMG_1234 · vista · a1b2c3.jpg": de qué foto es, qué es y de qué intento. */
export function outputName(originalName: string, runId: string, kind: UploadKind): string {
  const o = OUTPUTS[kind];
  return `${baseName(originalName)} · ${o.label} · ${runId.slice(-6)}.${o.ext}`;
}

export type PhotoOwner = FolderOwner;
export const photoOwner = folderOwner;

/** La carpeta de fotos del producto, creada si hace falta. */
export function photoFolderId(db: PrismaClient, token: string, email: string, owner: PhotoOwner, which: PhotoFolder): Promise<string> {
  return ensureFolder(db, token, email, photoFolder(owner.account, owner.product, which));
}

/** Los permisos para que el trabajador suba lo que haga en un intento. */
export async function outputTransfers(
  db: PrismaClient,
  token: string,
  email: string,
  args: { owner: PhotoOwner; runId: string; originalName: string; kinds: UploadKind[] },
): Promise<Partial<Record<UploadKind, Transfer>>> {
  const folderId = await photoFolderId(db, token, email, args.owner, 'trabajo');
  const out: Partial<Record<UploadKind, Transfer>> = {};
  for (const kind of args.kinds) {
    const type = OUTPUTS[kind].contentType;
    const url = await startResumableUpload(token, {
      folderId,
      name: outputName(args.originalName, args.runId, kind),
      type,
      properties: { mrbCorrida: args.runId, mrbTipo: kind },
    });
    out[kind] = { url, metodo: 'PUT', encabezados: { 'Content-Type': type } };
  }
  return out;
}

const runQuery = (runId: string) => `appProperties has { key='mrbCorrida' and value='${driveQueryValue(runId)}' } and trashed=false`;

/**
 * Lo que subió el trabajador para un intento: el último archivo de cada tipo.
 * Si un intento se repitió y quedaron dos, el viejo va a la papelera.
 */
export async function runOutputs(token: string, runId: string): Promise<Partial<Record<UploadKind, string>>> {
  const files = await listFiles(token, runQuery(runId), 'id,size,createdTime,appProperties');
  const byKind = new Map<string, typeof files>();
  for (const f of files) {
    const kind = f.appProperties?.mrbTipo;
    if (!kind || !(kind in OUTPUTS) || !(Number(f.size) > 0)) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), f]);
  }
  const out: Partial<Record<UploadKind, string>> = {};
  for (const [kind, list] of byKind) {
    const [newest, ...older] = [...list].sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
    out[kind as UploadKind] = driveRef(newest.id);
    for (const f of older) await trashFile(token, f.id).catch(() => undefined);
  }
  return out;
}

/**
 * Deja en Corregidas el JPG y el PNG finales de cada foto aprobada, con el
 * nombre del original, y saca de ahí los que ya no valen: se rehizo la foto o
 * se sacó de la lista. Lo que no subió la app, por ejemplo algo copiado desde
 * la Mac, no se toca.
 */
export async function syncCorrected(db: PrismaClient, productId: string): Promise<void> {
  const owner = await photoOwner(db, productId);
  const edits = await db.photoEdit.findMany({
    where: { productId, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      originalName: true,
      runs: { where: { step: LAST_PHOTO_STEP, status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { jpgUrl: true, pngUrl: true } },
    },
  });
  // El nombre de cada final: el del original, sin repetir.
  const wanted = new Map<string, string>();
  const used = new Set<string>();
  for (const e of edits) {
    const run = e.runs[0];
    if (!run) continue;
    for (const [ref, ext] of [
      [run.jpgUrl, 'jpg'],
      [run.pngUrl, 'png'],
    ] as const) {
      const id = driveIdOf(ref);
      if (!id) continue;
      let name = `${baseName(e.originalName)}.${ext}`;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${baseName(e.originalName)} (${n}).${ext}`;
      used.add(name.toLowerCase());
      wanted.set(id, name);
    }
  }
  await withDriveToken(db, async (token, email) => {
    const corrected = await photoFolderId(db, token, email, owner, 'corregidas');
    const work = await photoFolderId(db, token, email, owner, 'trabajo');
    const there = await listFiles(token, `'${corrected}' in parents and trashed=false`, 'id,appProperties');
    const inFolder = new Set(there.map((f) => f.id));
    for (const f of there) {
      if (f.appProperties?.mrbCorrida && !wanted.has(f.id)) await moveFile(token, f.id, { to: work, from: [corrected] });
    }
    for (const [id, name] of wanted) {
      if (inFolder.has(id)) continue;
      const f = await getFile(token, id, 'id,parents,trashed');
      if (!f || f.trashed) continue;
      await moveFile(token, id, { to: corrected, from: f.parents ?? [], name });
    }
  });
}

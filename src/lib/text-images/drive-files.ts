import type { PrismaClient } from '@/generated/prisma/client';
import { ensureFolder, folderOwner, listFiles, mergeFolderCopies, textImagesFolder, withDriveToken } from '@/lib/drive';
import { driveRef } from '@/lib/stored-files';
import { placeTextImages } from './place';

// Las imágenes que alguien sube a mano a la carpeta Imágenes con texto del
// Drive del producto: aparecen en Organización de multimedia de todas sus
// publicaciones, para ordenarlas como una foto más. Las que arma la app en
// esa carpeta llevan su marca (mrbProducto) y no se cuentan. Recibe la base
// por parámetro para poder probarlo con un Drive simulado.

type Db = PrismaClient;

// Los formatos que se pueden mostrar y subir al canal.
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Lee la carpeta y pone al día la lista: suma las nuevas y saca las que se
 * borraron o se movieron, también de las fotos elegidas. Crea la carpeta si
 * no está, para que se pueda subir ahí.
 */
export async function syncDriveTextImages(db: Db, args: { accountId: string; productId: string; now?: Date }): Promise<{ added: number; removed: number }> {
  const owner = await folderOwner(db, args.productId);
  if (owner.account.id !== args.accountId) return { added: 0, removed: 0 };
  const files = await withDriveToken(db, async (token, email) => {
    const folderId = await ensureFolder(db, token, email, textImagesFolder(owner.account, owner.product));
    return listFiles(token, `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`, 'id,name,mimeType,createdTime,appProperties');
  });
  const uploaded = files.filter((f) => IMAGE_TYPES.includes(f.mimeType) && !f.appProperties?.mrbProducto);
  const pubs = (await db.publication.findMany({ where: { productId: args.productId }, select: { id: true } })).map((p) => p.id);
  const known = await db.textImage.findMany({
    where: { fromDrive: true, publications: { some: { publication: { productId: args.productId } } } },
    select: { id: true, pngRef: true },
  });
  const byRef = new Map(known.map((k) => [k.pngRef, k.id]));
  const listed = new Set(uploaded.map((f) => driveRef(f.id)));

  let added = 0;
  for (const f of uploaded) {
    const ref = driveRef(f.id);
    let id = byRef.get(ref);
    if (!id) {
      id = (
        await db.textImage.create({
          data: {
            accountId: args.accountId,
            content: {},
            slot: 0,
            fromDrive: true,
            fileName: f.name,
            fileType: f.mimeType,
            pngRef: ref,
            pngAt: f.createdTime ? new Date(f.createdTime) : (args.now ?? new Date()),
          },
          select: { id: true },
        })
      ).id;
      added++;
    }
    // Es de todas las publicaciones del producto, también de las que se sumen después.
    await db.publicationTextImage.createMany({ data: pubs.map((publicationId) => ({ publicationId, textImageId: id })), skipDuplicates: true });
  }

  // Las que ya no están en la carpeta salen de la lista y de las fotos elegidas.
  const gone = known.filter((k) => !listed.has(k.pngRef ?? ''));
  if (gone.length > 0) {
    await placeTextImages(db, pubs, { remove: gone.map((g) => g.id) });
    await db.textImage.deleteMany({ where: { id: { in: gone.map((g) => g.id) } } });
  }
  return { added, removed: gone.length };
}

/** Lo mismo, sin cortar la pantalla si el Drive no responde o no está conectado. */
export async function syncDriveTextImagesQuietly(db: Db, args: { accountId: string; productId: string }): Promise<void> {
  try {
    await syncDriveTextImages(db, args);
  } catch (e) {
    console.error('No se pudo leer la carpeta Imágenes con texto del Drive.', e instanceof Error ? e.message : e);
  }
}

/** Lo mismo, desde una publicación: lee la carpeta de su producto. */
export async function syncDriveTextImagesFor(db: Db, args: { accountId: string; publicationId: string }): Promise<void> {
  const p = await db.publication.findFirst({ where: { id: args.publicationId, product: { accountId: args.accountId } }, select: { productId: true } });
  if (p) await syncDriveTextImagesQuietly(db, { accountId: args.accountId, productId: p.productId });
}

export type FolderFix = { productId: string; product: string; copies: number; moved: number; trashed: number; leftOver: number };

/**
 * Las carpetas Imágenes con texto repetidas en los productos de la cuenta: las
 * cuenta o, sin solo contar, junta todo en la más vieja, manda las vacías a la
 * papelera y vuelve a leer la carpeta que queda.
 */
export async function mergeTextImageFolders(
  db: Db,
  // from: desde qué producto seguir, en orden por nombre; budgetMs: hasta cuándo, para no cortar a la mitad.
  args: { accountId: string; dryRun: boolean; productIds?: string[]; from?: number; budgetMs?: number },
): Promise<{ checked: number; total: number; next: number | null; fixed: FolderFix[] }> {
  const started = Date.now();
  const account = await db.account.findUniqueOrThrow({ where: { id: args.accountId }, select: { id: true, name: true } });
  const products = await db.product.findMany({
    where: { accountId: account.id, ...(args.productIds ? { id: { in: args.productIds } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const fixed: FolderFix[] = [];
  const from = args.from ?? 0;
  let i = from;
  await withDriveToken(db, async (token, email) => {
    for (; i < products.length; i++) {
      if (args.budgetMs !== undefined && Date.now() - started > args.budgetMs) break;
      const p = products[i];
      const r = await mergeFolderCopies(db, token, email, textImagesFolder(account, p), { dryRun: args.dryRun });
      if (r.copies < 2) continue;
      fixed.push({ productId: p.id, product: p.name, copies: r.copies, moved: r.merge?.moved ?? 0, trashed: r.merge?.trashed ?? 0, leftOver: r.merge?.leftOver ?? 0 });
    }
  });
  if (!args.dryRun) for (const f of fixed) await syncDriveTextImagesQuietly(db, { accountId: account.id, productId: f.productId });
  return { checked: i - from, total: products.length, next: i < products.length ? i : null, fixed };
}

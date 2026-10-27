import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { asIsProblem } from '@/domain/media';
import { uploadContent, withDriveToken } from '@/lib/drive';
import { plural } from '@/lib/format';
import { photoFolderId, photoOwner, syncCorrected } from '@/lib/photo-files';
import { addChannelPhotos, PhotoError, type AsIsCheck } from '@/lib/photos';
import { setAsIs } from '@/lib/photo-queue';
import { driveRef, storageError } from '@/lib/stored-files';

// Lo que se hace con las fotos de un producto desde una publicación, igual
// desde el paso Imágenes que desde Claude: sumar las que tiene en el canal y
// decidir si una se usa tal cual. Las fotos son del producto: las ven todas
// sus publicaciones.

/** Qué impide usar una foto tal cual en el canal de la publicación. */
export async function asIsCheckFor(db: PrismaClient, publicationId: string): Promise<AsIsCheck> {
  const pub = await db.publication.findUniqueOrThrow({ where: { id: publicationId }, select: { store: { select: { channel: true } } } });
  const adapter = getChannelAdapter(pub.store.channel.kind, pub.store.channel.name);
  return (file) => asIsProblem(file, adapter.photos, adapter.name);
}

/**
 * Deja Corregidas al día después de una decisión. Si el Drive no responde no
 * corta nada: se pone al día en la próxima.
 */
export async function tidyCorrected(db: PrismaClient, productId: string) {
  try {
    await syncCorrected(db, productId);
  } catch (e) {
    console.error('No se pudo ordenar la carpeta Corregidas.', storageError(e) ?? e);
  }
}

/** Suma al paso Imágenes las fotos que el producto tiene publicadas en el canal, en su tamaño más grande. */
export async function addChannelPhotosOf(db: PrismaClient, args: { productId: string; userId: string | null }): Promise<string> {
  const owner = await photoOwner(db, args.productId);
  const r = await withDriveToken(db, async (token, email) => {
    const folderId = await photoFolderId(db, token, email, owner, 'originales');
    return addChannelPhotos(
      db,
      { productId: args.productId, userId: args.userId },
      {
        fetch,
        put: async (name, body, contentType) => ({
          url: driveRef((await uploadContent(token, { folderId, name, type: contentType, data: body, properties: { mrbProducto: args.productId } })).id),
        }),
      },
    );
  });
  const parts = [
    r.added > 0 ? `Se sumaron ${plural(r.added, 'foto')}.` : 'No se sumó ninguna foto.',
    r.already > 0 ? `${plural(r.already, 'ya estaba', 'ya estaban')} en la línea.` : '',
    ...r.failed,
  ];
  if (r.added === 0 && r.failed.length > 0) throw new PhotoError(parts.filter(Boolean).join(' '));
  return parts.filter(Boolean).join(' ');
}

/**
 * Usa el original tal cual, porque ya viene editado, o lo vuelve a mandar a
 * corregir en la Mac. Para usarlo tal cual, el canal de la publicación lo
 * tiene que aceptar así. Null si la foto no es del producto de la publicación.
 */
export async function setPhotoAsIs(db: PrismaClient, args: { publicationId: string; editId: string; asIs: boolean }): Promise<string | null> {
  const pub = await db.publication.findUnique({ where: { id: args.publicationId }, select: { productId: true } });
  const edit = pub
    ? await db.photoEdit.findFirst({ where: { id: args.editId, productId: pub.productId }, select: { id: true, productId: true, originalType: true, originalSize: true } })
    : null;
  if (!edit) return null;
  if (args.asIs) {
    const problem = (await asIsCheckFor(db, args.publicationId))({ type: edit.originalType, size: edit.originalSize });
    if (problem) throw new PhotoError(problem);
  }
  await setAsIs(db, { editId: edit.id, asIs: args.asIs });
  await tidyCorrected(db, edit.productId);
  return args.asIs ? 'Se usa el original tal cual.' : 'Vuelve a la línea para corregirla en la Mac.';
}

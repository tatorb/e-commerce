import type { PrismaClient } from '@/generated/prisma/client';
import { DriveError, driveIdOf, fileContent, trashFile, withDriveToken } from '@/lib/drive';
import { deleteBlob, FileError, isOwnBlobUrl, readBlob } from '@/lib/files';

// Dónde está guardado cada archivo de la app: en el Google Drive del estudio
// ("drive:<id del archivo>") o, lo que se subió antes de pasar al Drive, en el
// depósito de Vercel (su dirección). La app los lee y los borra igual, sea
// donde sea. Recibe la base por parámetro para poder probarlo.

export { driveIdOf, driveRef } from '@/lib/drive';

/** Si el archivo todavía está en el depósito de Vercel. */
export const inVercel = (ref: string | null | undefined): ref is string => Boolean(ref && isOwnBlobUrl(ref));

/** El archivo, para mandarlo a quien lo pide. Null si ya no está. */
export async function readStored(db: PrismaClient, ref: string): Promise<Response | null> {
  const id = driveIdOf(ref);
  if (id) return withDriveToken(db, (token) => fileContent(token, id));
  return readBlob(ref);
}

/** Manda el archivo a la papelera del Drive, o lo borra del depósito. Si ya no estaba, no pasa nada. */
export async function removeStored(db: PrismaClient, ref: string): Promise<void> {
  const id = driveIdOf(ref);
  if (!id) return deleteBlob(ref);
  await withDriveToken(db, async (token) => {
    try {
      await trashFile(token, id);
    } catch (e) {
      if (!(e instanceof DriveError && e.status === 404)) throw e;
    }
  });
}

/** Si el error es de leer o guardar un archivo: el motivo, para mostrar. */
export function storageError(e: unknown): string | null {
  return e instanceof DriveError || e instanceof FileError ? e.message : null;
}

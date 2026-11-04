import type { PrismaClient } from '@/generated/prisma/client';
import { readStored } from '@/lib/stored-files';

// El PNG de las imágenes con texto, para mostrarlo en la app y subirlo al
// canal como una foto más. Aparte del paso, para que lo pueda usar
// Organización de multimedia sin depender de todo lo demás.

/** Dónde se ve el PNG. Cambia cuando se vuelve a generar. */
export const textImageHref = (id: string, at: Date) => `/api/imagenes-con-texto/${id}?v=${at.getTime()}`;

/** El PNG de una imagen con texto. Null si todavía no se generó o ya no está en el Drive. */
export async function textImagePng(
  db: PrismaClient,
  id: string,
): Promise<{ data: Uint8Array; productId: string | null; at: Date; type: string; name: string } | null> {
  const row = await db.textImage.findUnique({ where: { id }, select: { pngRef: true, pngAt: true, fileType: true, fileName: true, publications: { select: { publication: { select: { productId: true } } }, take: 1 } } });
  if (!row?.pngRef || !row.pngAt) return null;
  const res = await readStored(db, row.pngRef);
  if (!res) return null;
  // Las que arma la app son PNG; las subidas a mano al Drive, del tipo que tengan.
  const type = row.fileType ?? 'image/png';
  const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
  return { data: new Uint8Array(await res.arrayBuffer()), productId: row.publications[0]?.publication.productId ?? null, at: row.pngAt, type, name: `imagen-con-texto.${ext}` };
}

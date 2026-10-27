import type { Prisma, PrismaClient } from '@/generated/prisma/client';

// Las medidas de una familia en la base: lo que es de la familia se guarda
// igual en todas sus publicaciones, en la misma transacción, y se mueven
// juntas en el pipeline. Una publicación sin familia es una familia de una.

type Db = PrismaClient | Prisma.TransactionClient;

/** Las publicaciones de la familia de una, ella incluida, en orden fijo. Sin familia, solo ella. */
export async function familyMemberIds(db: Db, publicationId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT m.id FROM publications p JOIN publications m ON m."familyId" = p."familyId"
    WHERE p.id = ${publicationId} AND p."familyId" IS NOT NULL
    ORDER BY m.id`;
  return rows.length > 0 ? rows.map((r) => r.id) : [publicationId];
}

/**
 * Bloquea las filas de todas las medidas hasta que termine la transacción,
 * siempre en el mismo orden, así dos pedidos a la vez no se traban. Devuelve
 * sus códigos.
 */
export async function lockFamily(tx: Prisma.TransactionClient, publicationId: string): Promise<string[]> {
  const ids = await familyMemberIds(tx, publicationId);
  await tx.$queryRaw`SELECT id FROM publications WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
  // Alguien la sumó o la sacó de la familia mientras tanto: se vuelve a leer ya bloqueada.
  const again = await familyMemberIds(tx, publicationId);
  return again.length === ids.length && again.every((id, i) => id === ids[i]) ? ids : lockFamily(tx, publicationId);
}

/** Guarda lo mismo en todas las medidas de la familia. */
export async function writeToFamily(db: Db, publicationId: string, data: Prisma.PublicationUpdateManyMutationInput): Promise<string[]> {
  const ids = await familyMemberIds(db, publicationId);
  await db.publication.updateMany({ where: { id: { in: ids } }, data });
  return ids;
}

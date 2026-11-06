import type { PrismaClient } from '@/generated/prisma/client';
import { planMainOptions } from '@/domain/sale-options';

// Las opciones de venta de cada medida, con lo leído del canal: cuál es la
// principal y a cuál apuntan las demás. Corre al final de cada lectura de la
// tienda. No sube nada al canal. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

/** Agrupa las publicaciones de la tienda por su medida en el canal. Devuelve cuántas cambiaron. */
export async function assignSaleOptions(db: Db, storeId: string): Promise<number> {
  const rows = await db.publication.findMany({
    where: { storeId },
    select: {
      id: true,
      mainOptionId: true,
      pipelineStatus: true,
      createdAt: true,
      leadOf: { select: { id: true } },
      channelCopy: { select: { channelProductId: true, status: true } },
    },
  });
  const changes = planMainOptions(
    rows.map((r) => ({
      id: r.id,
      channelProductId: r.channelCopy?.channelProductId ?? null,
      mainOptionId: r.mainOptionId,
      status: r.channelCopy?.status ?? null,
      pipelineStatus: r.pipelineStatus,
      familyLead: r.leadOf !== null,
      createdAt: r.createdAt,
    })),
  );
  if (changes.size === 0) return 0;
  // Primero las que pasan a ser principales, así ninguna apunta a otra que todavía apunta a una tercera.
  const ordered = [...changes.entries()].sort((a, b) => Number(a[1] !== null) - Number(b[1] !== null));
  await db.$transaction(ordered.map(([id, mainOptionId]) => db.publication.update({ where: { id }, data: { mainOptionId } })));
  return changes.size;
}

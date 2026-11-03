import type { PrismaClient } from '@/generated/prisma/client';

// Las unidades que vendió cada publicación en los últimos 90 días, contadas
// con las ventas que la app leyó del canal. Solo para las tiendas que ya
// trajeron sus ventas viejas: si no, faltarían algunas y se seguiría con el
// dato de la planilla importada.

export const SALES_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

/** Unidades vendidas en 90 días, por publicación. Las de tiendas sin las ventas completas no están. */
export async function unitsLast90(db: PrismaClient, publicationIds: string[], now = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (publicationIds.length === 0) return out;
  const pubs = await db.publication.findMany({
    where: { id: { in: publicationIds }, store: { saleReader: { historyDoneAt: { not: null } } } },
    select: { id: true, storeId: true },
  });
  if (pubs.length === 0) return out;
  for (const p of pubs) out.set(p.id, 0);
  const stores = [...new Set(pubs.map((p) => p.storeId))];
  const ids = pubs.map((p) => p.id);
  const from = new Date(now.getTime() - SALES_DAYS * DAY);
  const rows = await db.$queryRaw<{ id: string; units: bigint | number | null }[]>`
    SELECT l->>'publicationId' AS id, SUM(COALESCE((l->>'quantity')::numeric, 0)) AS units
    FROM sales s, jsonb_array_elements(s.lines) l
    WHERE s."storeId" = ANY(${stores}) AND s.state <> 'CANCELLED' AND s."orderedAt" >= ${from}::timestamp
      AND l->>'publicationId' = ANY(${ids})
    GROUP BY 1`;
  for (const r of rows) out.set(r.id, Number(r.units ?? 0));
  return out;
}

import type { Prisma } from '@/generated/prisma/client';
import type { ChannelAdapter } from '@/channels/types';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';

// El título bloqueado de una familia: el título es uno solo para todas las
// medidas, y el canal no deja cambiarlo si alguna tiene ventas. Las consultas
// suman este pedazo a la publicación para saberlo de una vez.

export const FAMILY_LOCK_SELECT = {
  select: {
    members: {
      select: { id: true, measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { metrics: true } } },
    },
  },
} satisfies Prisma.ListingFamilyDefaultArgs;

type WithFamily = {
  id: string;
  measurements: { metrics: unknown }[];
  family?: { members: { id: string; measurements: { metrics: unknown }[] }[] } | null;
};

/**
 * Lo que dicen los datos de ventas sobre el título: de la publicación o, en
 * una familia, bloqueado si alguna medida tiene ventas y libre solo si todas
 * se sabe que no tienen. Null si no se sabe.
 */
export function titleLockFromData(adapter: Pick<ChannelAdapter, 'titleLock'>, p: WithFamily): boolean | null {
  const own = adapter.titleLock(latestMetrics(p.measurements));
  const others = (p.family?.members ?? []).filter((m) => m.id !== p.id).map((m) => adapter.titleLock(latestMetrics(m.measurements)));
  if (others.length === 0) return own;
  const all = [own, ...others];
  if (all.some((l) => l === true)) return true;
  return all.every((l) => l === false) ? false : null;
}

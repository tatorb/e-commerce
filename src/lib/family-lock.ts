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

const LATEST = { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { metrics: true } } as const;

/**
 * Las otras opciones de venta de la misma medida (en Mercado Libre, el mismo
 * producto del canal): comparten el título y las ventas de una bloquean el de
 * todas. Se suma a la publicación, al lado de la familia.
 */
export const OPTIONS_LOCK_SELECT = {
  mainOption: { select: { id: true, measurements: LATEST, saleOptions: { select: { id: true, measurements: LATEST } } } },
  saleOptions: { select: { id: true, measurements: LATEST } },
} satisfies Prisma.PublicationSelect;

type Measured = { id: string; measurements: { metrics: unknown }[] };

type WithFamily = Measured & {
  family?: { members: Measured[] } | null;
  mainOption?: (Measured & { saleOptions?: Measured[] }) | null;
  saleOptions?: Measured[];
};

/**
 * Lo que dicen los datos de ventas sobre el título: de la publicación o, en
 * una familia o con otras opciones de venta, bloqueado si alguna tiene ventas
 * y libre solo si todas se sabe que no tienen. Null si no se sabe.
 */
export function titleLockFromData(adapter: Pick<ChannelAdapter, 'titleLock'>, p: WithFamily): boolean | null {
  const own = adapter.titleLock(latestMetrics(p.measurements));
  const related = new Map<string, Measured>();
  for (const m of [...(p.family?.members ?? []), ...(p.mainOption ? [p.mainOption, ...(p.mainOption.saleOptions ?? [])] : []), ...(p.saleOptions ?? [])]) {
    if (m.id !== p.id) related.set(m.id, m);
  }
  const others = [...related.values()].map((m) => adapter.titleLock(latestMetrics(m.measurements)));
  if (others.length === 0) return own;
  const all = [own, ...others];
  if (all.some((l) => l === true)) return true;
  return all.every((l) => l === false) ? false : null;
}

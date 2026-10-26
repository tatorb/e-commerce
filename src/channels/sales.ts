import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreSales } from './mercadolibre/sales';
import type { ChannelSales } from './sales-types';

// De qué canales se leen las ventas. Los tipos están en sales-types.ts, así
// cada canal los usa sin depender de esta lista.

export { SalesAccessError, type ChannelOrder, type ChannelOrderLine, type ChannelSales, type SalesNotice } from './sales-types';

const SALES: Partial<Record<ChannelKind, ChannelSales>> = {
  MERCADOLIBRE: mercadolibreSales,
};

export function getChannelSales(kind: ChannelKind): ChannelSales | null {
  return SALES[kind] ?? null;
}

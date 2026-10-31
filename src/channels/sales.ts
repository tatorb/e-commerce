import type { ChannelKind } from '@/generated/prisma/enums';
import { mercadolibreSales, mercadolibreSalesLedger } from './mercadolibre/sales';
import type { ChannelSales, ChannelSalesLedger } from './sales-types';

// De qué canales se leen las ventas. Los tipos están en sales-types.ts, así
// cada canal los usa sin depender de esta lista.

export {
  SalesAccessError,
  type ChannelOrder,
  type ChannelOrderLine,
  type ChannelSales,
  type SalesNotice,
  type ChannelSalesLedger,
  type ChannelSaleRecord,
  type ChannelSaleLine,
  type ChannelPayment,
  type ChannelPaymentMoney,
  type ChannelShipment,
  type ChannelShipState,
  type ChannelShipKind,
  type ChannelSaleState,
  type ChannelSalesPage,
  type SaleNotice,
} from './sales-types';

const SALES: Partial<Record<ChannelKind, ChannelSales>> = {
  MERCADOLIBRE: mercadolibreSales,
};

const LEDGERS: Partial<Record<ChannelKind, ChannelSalesLedger>> = {
  MERCADOLIBRE: mercadolibreSalesLedger,
};

export function getChannelSales(kind: ChannelKind): ChannelSales | null {
  return SALES[kind] ?? null;
}

/** Los importes, los pagos y los envíos de las ventas, para la sección Ventas. */
export function getChannelSalesLedger(kind: ChannelKind): ChannelSalesLedger | null {
  return LEDGERS[kind] ?? null;
}

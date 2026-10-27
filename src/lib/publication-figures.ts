import { discountText, priceText } from '@/domain/channel-sync';
import { parseVariations, type VariantLike } from '@/domain/media';
import { latestMetrics } from '@/domain/measurements';
import { formatPercent, formatPrice } from '@/domain/money';
import { channelQuantities, parseQuantities, quantityText, sameQuantities, totalQuantity, type QuantityLine } from '@/domain/quantities';
import { plannedText, singleMeasure, type StockPlan } from '@/lib/stock-plan';

// Precio, cantidad y ventas de una publicación, en texto, para la tarjeta corta
// de cada una en el producto: lo que hay en el canal y lo que falta subir. Sin
// leer del canal, lo que tiene la app.

export type PublicationFigures = {
  price: { now: string; discount: string | null; pending: string | null } | null;
  quantity: { now: string; empty: boolean; full: boolean; pending: string | null } | null;
  // Los vendidos que muestra el canal y las ventas de 90 días, si se saben.
  sales: { sold: number | null; last90: number | null };
};

type Numeric = { toString(): string } | number | string;

export type FiguresInput = {
  price: Numeric | null;
  quantities: unknown;
  // La medida elegida, si vende una sola.
  variantKey?: string | null;
  measurements: { metrics: unknown }[];
  channelCopy: {
    price: Numeric | null;
    discount: Numeric | null;
    quantity: number | null;
    variations: unknown;
    details: unknown;
    stockInChannel: boolean;
    missingSince: Date | null;
  } | null;
};

export function publicationFigures(pub: FiguresInput, product: { variants: VariantLike[] }, plan: StockPlan | null): PublicationFigures {
  const copy = pub.channelCopy && !pub.channelCopy.missingSince ? pub.channelCopy : null;

  const channelPrice = copy ? priceText(copy.price) : null;
  const appPrice = priceText(pub.price);
  const shownPrice = channelPrice ?? appPrice;
  const discount = copy ? Number(discountText(copy.discount) ?? 0) : 0;
  const price = shownPrice
    ? {
        now: formatPrice(shownPrice),
        discount: discount > 0 ? formatPercent(discount) : null,
        pending: channelPrice && appPrice && appPrice !== channelPrice ? formatPrice(appPrice) : null,
      }
    : null;

  const variations = copy ? parseVariations(copy.variations) : [];
  // Si vende una sola medida del producto, se nombra: "STD: 2".
  const sole = variations.length === 0 ? singleMeasure(product, copy, pub.variantKey) : null;
  const soleLabel = sole ? (sole.measure ?? sole.sku ?? null) : null;
  const text = (lines: QuantityLine[]) => (soleLabel ? `${soleLabel}: ${quantityText(lines)}` : quantityText(lines));
  const channel = copy ? channelQuantities(copy.quantity, variations) : null;
  const app = parseQuantities(pub.quantities);
  const shown = copy ? channel : app;
  const pending =
    !channel ? null
    : plan?.managed ? (plan.pending ? plannedText(plan) : null)
    : app && !sameQuantities(app, channel) ? text(app)
    : null;
  const quantity = shown ? { now: text(shown), empty: totalQuantity(shown) === 0, full: copy?.stockInChannel ?? false, pending } : null;

  const metrics = latestMetrics(pub.measurements);
  const sales = {
    sold: typeof metrics.sold_visible === 'number' ? metrics.sold_visible : null,
    last90: typeof metrics.sales_90d === 'number' ? metrics.sales_90d : null,
  };
  return { price, quantity, sales };
}

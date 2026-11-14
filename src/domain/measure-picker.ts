import type { MeasureChoice } from '@/lib/publication-measure';

// Si la página de una publicación muestra la tarjeta para elegir su medida. Va
// aparte de la tarjeta, que corre en el navegador, porque la página lo pregunta
// en el servidor.

export const skuOf = (sku: string | null) => (sku ?? '').trim().toUpperCase();

/** Si hay algo para mostrar: sin medida, o con un SKU en el canal que no es el de su medida. */
export function measurePickerNeeded(choice: MeasureChoice | null): boolean {
  if (!choice) return false;
  if (choice.unknown) return true;
  const sku = choice.current?.sku;
  return Boolean(sku && choice.options.some((o) => o.skuToPush || (o.externalId && skuOf(o.channelSku) !== skuOf(sku))));
}

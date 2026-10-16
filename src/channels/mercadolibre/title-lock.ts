import type { Metrics } from '@/domain/measurements';

// En Mercado Libre, una publicación que ya vendió no deja cambiar el título.
// Se sabe por los vendidos visibles; las ventas de 90 días solo alcanzan para
// decir que sí vendió, porque cero en 90 días no quiere decir cero de siempre.
export function mercadolibreTitleLock(metrics: Metrics): boolean | null {
  const sold = typeof metrics.sold_visible === 'number' ? metrics.sold_visible : null;
  const recent = typeof metrics.sales_90d === 'number' ? metrics.sales_90d : null;
  if ((sold ?? 0) > 0 || (recent ?? 0) > 0) return true;
  if (sold === 0) return false;
  return null;
}

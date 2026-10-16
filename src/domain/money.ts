/**
 * Lee un precio escrito a mano, con la costumbre argentina: punto para los
 * miles y coma para los decimales. Acepta "125000", "125.000", "$ 125.000,50"
 * o "125000.5". Devuelve null si está vacío y "invalid" si no se entiende.
 */
export function parsePrice(raw: string): number | null | 'invalid' {
  const text = raw.replace(/[\s$]/g, '');
  if (text === '') return null;

  let normalized: string;
  if (text.includes(',')) {
    // Coma decimal: los puntos son separadores de miles.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(text)) return 'invalid';
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "125.000" o "1.125.000": puntos de miles.
    normalized = text.replace(/\./g, '');
  } else if (/^\d+(\.\d{1,2})?$/.test(text)) {
    normalized = text;
  } else {
    return 'invalid';
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return 'invalid';
  return value;
}

/** Muestra un precio en pesos, con el formato argentino. */
export function formatPrice(value: number | string | null | undefined, currency = 'ARS'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

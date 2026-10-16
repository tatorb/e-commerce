import type { TitleRules } from '@/domain/title-rules';

// Reglas de título de Mercado Libre, como valores iniciales. Cada cuenta las
// puede cambiar en Ajustes. Mercado Libre pide títulos de hasta 60 caracteres,
// sin datos de envío, precio, promociones ni condición del producto.
export const MERCADOLIBRE_TITLE_RULES: TitleRules = {
  maxLength: 60,
  forbiddenChars: '!¡¿?*$%@#&=<>{}[]|~^_"',
  forbiddenWords: [
    'envío gratis',
    'envio gratis',
    'oferta',
    'promoción',
    'promocion',
    'descuento',
    'liquidación',
    'liquidacion',
    'cuotas sin interés',
    'cuotas sin interes',
    'stock',
    'nuevo',
    'usado',
  ],
  structures: [
    {
      family: '',
      structure: 'Tipo de producto + Marca y modelo del vehículo + Motor o cilindrada + Años + Marca del repuesto',
    },
  ],
};

/** Link a la búsqueda en Mercado Libre Argentina, para mirarla a mano. */
export function mercadolibreSearchUrl(query: string): string | null {
  const slug = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `https://listado.mercadolibre.com.ar/${slug}` : null;
}

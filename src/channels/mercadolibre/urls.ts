// Direcciones de Mercado Libre Argentina. Se pueden cambiar con variables de
// entorno para probar contra un Mercado Libre simulado.

export const suggestUrl = () => process.env.MERCADOLIBRE_SUGGEST_URL || 'https://http2.mlstatic.com/resources/sites/MLA/autosuggest';
export const apiUrl = () => process.env.MERCADOLIBRE_API_URL || 'https://api.mercadolibre.com';
export const listingUrl = () => process.env.MERCADOLIBRE_LISTING_URL || 'https://listado.mercadolibre.com.ar';
export const authUrl = () => process.env.MERCADOLIBRE_AUTH_URL || 'https://auth.mercadolibre.com.ar/authorization';

import { extensionOf, safeFileName } from './file-rules';

// Qué fotos se aceptan en la línea de imágenes y dónde van en el depósito.
// Sin nada del servidor, para usarlo también en el navegador.

const MB = 1024 * 1024;

// Los originales que se aceptan, según la extensión. El navegador muchas veces
// no informa el tipo de las HEIC, así que se fija acá.
export const ORIGINAL_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};
export const ORIGINAL_MAX_BYTES = 100 * MB;
// Una foto publicada en el canal: chica, alcanza con menos.
export const CHANNEL_PHOTO_MAX_BYTES = 20 * MB;

/** Dónde van los archivos de una foto. */
export const photoPrefix = (productId: string) => `imagenes/${productId}/`;
export const originalPathname = (productId: string, name: string) =>
  `${photoPrefix(productId)}originales/${safeFileName(name)}`;

export function originalTypeFor(name: string): string | null {
  return ORIGINAL_TYPES[extensionOf(name)] ?? null;
}

/** Dónde la app muestra un archivo de la línea, solo con sesión iniciada. */
export const photoFileHref = (
  kind: 'antes' | 'original' | 'vista' | 'mascara' | 'png' | 'jpg',
  ids: { foto?: string; paso?: string },
  download = false,
) => `/api/imagenes/ver?${new URLSearchParams({ tipo: kind, ...(ids.foto ? { foto: ids.foto } : {}), ...(ids.paso ? { paso: ids.paso } : {}), ...(download ? { descargar: '1' } : {}) })}`;

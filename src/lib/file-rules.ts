import type { ProductFileKind } from '@/generated/prisma/enums';

// Qué archivos del fabricante se aceptan. Sin nada del servidor, para usarlo
// también en el navegador.

/** Dónde la app muestra un archivo, solo con sesión iniciada. */
export const fileHref = (fileId: string) => `/api/archivos/${fileId}`;

const MB = 1024 * 1024;

// Qué se puede subir y hasta qué peso, según la extensión.
export const FILE_TYPES: Record<string, { contentType: string; kind: ProductFileKind; maxBytes: number }> = {
  jpg: { contentType: 'image/jpeg', kind: 'IMAGE', maxBytes: 10 * MB },
  jpeg: { contentType: 'image/jpeg', kind: 'IMAGE', maxBytes: 10 * MB },
  png: { contentType: 'image/png', kind: 'IMAGE', maxBytes: 10 * MB },
  webp: { contentType: 'image/webp', kind: 'IMAGE', maxBytes: 10 * MB },
  gif: { contentType: 'image/gif', kind: 'IMAGE', maxBytes: 10 * MB },
  pdf: { contentType: 'application/pdf', kind: 'PDF', maxBytes: 50 * MB },
};

export const MAX_FILES = 40;

export function extensionOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

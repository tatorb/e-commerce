import type { ProductFileKind } from '@/generated/prisma/enums';

// Qué archivos del fabricante se aceptan y cómo se nombran en el depósito.
// Sin nada del servidor, para usarlo también en el navegador.

// El depósito es privado: los archivos solo se ven a través de la app, con sesión.
export const BLOB_ACCESS = 'private' as const;

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

/** Dónde se guardan los archivos de un producto en el depósito. */
export const filesPrefix = (productId: string) => `productos/${productId}/`;

/** Un nombre de archivo sin signos raros, para la dirección. */
export function safeFileName(name: string): string {
  const ext = extensionOf(name);
  const base = name
    .slice(0, ext ? -(ext.length + 1) : undefined)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();
  return `${base || 'archivo'}.${ext}`;
}

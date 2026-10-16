import Papa from 'papaparse';
import type { Compat, ContentSnapshot } from '@/domain/content';
import type { FieldKey } from './fields';

// Planilla de contenido: una fila por publicación, con lo que la app ya sabe
// y lugar para completar el resto a mano o con IA. Se vuelve a cargar por el
// importador, que reconoce estas columnas solo (ver los sinónimos en fields.ts).

export const CONTENT_COLUMNS: { header: string; field: FieldKey }[] = [
  { header: 'ID de la publicación', field: 'pub.externalId' },
  { header: 'Link', field: 'pub.url' },
  { header: 'SKU', field: 'product.skus' },
  { header: 'Título', field: 'pub.title' },
  { header: 'Descripción', field: 'pub.description' },
  { header: 'Marca del repuesto', field: 'product.brand' },
  { header: 'Número de pieza', field: 'product.partNumber' },
  { header: 'Tipo de producto', field: 'product.productType' },
  { header: 'Sistema del motor', field: 'product.engineSystem' },
  { header: 'Línea', field: 'product.line' },
  { header: 'Origen', field: 'product.origin' },
  { header: 'Garantía', field: 'product.warranty' },
  { header: 'Contenido del kit', field: 'product.kitContents' },
  { header: 'Medidas por SKU', field: 'product.measures' },
  { header: 'Ficha técnica', field: 'product.specs' },
  { header: 'Compatibilidades', field: 'compat.list' },
  { header: 'Links de fotos', field: 'asset.photos' },
  { header: 'Link del video', field: 'asset.videos' },
];

export type ContentSheetRow = {
  externalId: string | null;
  url: string | null;
  content: ContentSnapshot;
};

function years(c: Compat): string {
  if (c.yearFrom !== null && c.yearTo !== null) return c.yearFrom === c.yearTo ? `${c.yearFrom}` : `${c.yearFrom}-${c.yearTo}`;
  if (c.yearFrom !== null) return `${c.yearFrom}-`;
  if (c.yearTo !== null) return `-${c.yearTo}`;
  return '';
}

/**
 * Una compatibilidad como "Marca | Modelo | Motor | Años", sin barras de más
 * al final. Siempre queda al menos una barra, si no se leería como nota.
 */
export function compatLine(c: Compat): string {
  const parts = [c.vehicleBrand ?? '', c.model ?? '', c.engine ?? '', years(c)];
  if (c.note) {
    if (parts.every((p) => p === '')) return c.note;
    parts.push(c.note);
  }
  while (parts.length > 2 && parts[parts.length - 1] === '') parts.pop();
  return parts.join(' | ').trim();
}

function cellsFor(row: ContentSheetRow): string[] {
  const c = row.content;
  const skus = c.measures.flatMap((v) => (v.sku ? [v.sku] : []));
  const measures = c.measures
    .map((v) => (v.sku ? `${v.sku}: ${v.measure ?? ''}`.trim() : (v.measure ?? '')))
    .filter(Boolean);
  return [
    row.externalId ?? '',
    row.url ?? '',
    skus.join(' / '),
    c.title ?? '',
    c.description ?? '',
    c.brand ?? '',
    c.partNumber ?? '',
    c.productType ?? '',
    c.engineSystem ?? '',
    c.line ?? '',
    c.origin ?? '',
    c.warranty ?? '',
    c.kitContents ?? '',
    measures.join('\n'),
    c.specs.map((s) => `${s.name}: ${s.value}`).join('\n'),
    c.compatibilities.map(compatLine).join('\n'),
    c.photos.join('\n'),
    c.videos.join('\n'),
  ];
}

/**
 * Arma el CSV, separado por comas. Empieza con la marca de UTF-8 para que
 * Excel y Google Sheets muestren bien los acentos.
 */
export function buildContentSheet(rows: ContentSheetRow[]): string {
  const csv = Papa.unparse(
    { fields: CONTENT_COLUMNS.map((c) => c.header), data: rows.map(cellsFor) },
    { newline: '\r\n', quotes: true },
  );
  return `﻿${csv}\r\n`;
}

export function contentSheetFileName(accountSlug: string, date: string): string {
  return `planilla-de-contenido-${accountSlug}-${date}.csv`;
}

/** Texto para pegarle a una IA junto con la planilla. */
export function contentSheetInstructions(channelName: string): string {
  return `Te paso una planilla CSV con publicaciones de ${channelName}. Cada fila es una publicación y la columna "Link" lleva a la publicación. Necesito que completes la planilla con lo que hoy muestra cada publicación, sin mejorar ni corregir nada.

Reglas:
- No cambies los nombres ni el orden de las columnas.
- No toques las columnas "ID de la publicación", "Link" ni "SKU".
- Si una celda ya tiene un dato, dejalo como está.
- Copiá los datos tal como aparecen en la publicación. No inventes ni supongas nada. Si un dato no aparece, dejá la celda vacía.
- En las columnas con varios datos, poné uno por línea o separalos con punto y coma.

Formato de cada columna:
- Título y Descripción: el texto completo, tal como está publicado.
- Marca del repuesto, Número de pieza, Tipo de producto, Sistema del motor, Línea, Origen, Garantía y Contenido del kit: un dato por celda.
- Medidas por SKU: una línea por SKU con la forma "SKU: medida", por ejemplo "ABC-123: STD" o "ABC-124: 0,50 mm". La planilla ya trae los SKU, completá la medida.
- Ficha técnica: una línea por dato con la forma "Nombre: valor", por ejemplo "Diámetro: 82,5 mm".
- Compatibilidades: una línea por vehículo con la forma "Marca | Modelo | Motor | Años", por ejemplo "Volkswagen | Gol | 1.6 8v | 1995-2012". Si no aparecen los años, dejalos vacíos.
- Links de fotos: el link de cada foto, en el orden en que aparecen.
- Link del video: el link del video, si tiene.

Devolveme la planilla completa en formato CSV separado por comas, con las mismas columnas, lista para descargar.`;
}

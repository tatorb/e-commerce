import { FIELDS, isConfidentialHeader, isFieldKey, normalizeHeader, type FieldKey } from './fields';
import type { Cell, SheetData } from './spreadsheet';

// Relación entre columnas del archivo y campos de la app: la propuesta
// automática, la que se guardó antes y la extracción de las filas.

export type Mapping = Record<string, FieldKey | null>;

export type SavedMapping = { id: string; name: string; headers: string[]; fields: Record<string, string> };

const SYNONYM_INDEX = new Map<string, FieldKey>();
for (const f of FIELDS) for (const s of f.synonyms) if (!SYNONYM_INDEX.has(s)) SYNONYM_INDEX.set(s, f.key);

/** Propone un campo para cada columna. Cada campo se usa una sola vez. */
export function suggestMapping(headers: string[]): Mapping {
  const used = new Set<FieldKey>();
  const mapping: Mapping = {};
  for (const header of headers) {
    if (isConfidentialHeader(header)) {
      mapping[header] = null;
      continue;
    }
    const field = SYNONYM_INDEX.get(normalizeHeader(header)) ?? null;
    if (field && !used.has(field)) {
      used.add(field);
      mapping[header] = field;
    } else {
      mapping[header] = null;
    }
  }
  return mapping;
}

/**
 * Busca la relación guardada que mejor encaja con estos encabezados: tiene
 * que reconocer al menos el 80 % de las columnas con las que se armó.
 */
export function findSavedMapping(headers: string[], saved: SavedMapping[]): SavedMapping | null {
  const present = new Set(headers);
  let best: { mapping: SavedMapping; score: number } | null = null;
  for (const m of saved) {
    if (m.headers.length === 0) continue;
    const score = m.headers.filter((h) => present.has(h)).length / m.headers.length;
    if (score >= 0.8 && (!best || score > best.score)) best = { mapping: m, score };
  }
  return best?.mapping ?? null;
}

/** Aplica una relación guardada; lo que no cubre queda con la propuesta. */
export function applySavedMapping(headers: string[], saved: SavedMapping): Mapping {
  const mapping = suggestMapping(headers);
  const used = new Set<FieldKey>();
  for (const header of headers) {
    if (isConfidentialHeader(header)) continue;
    const field = saved.fields[header];
    if (field && isFieldKey(field)) {
      mapping[header] = field;
      used.add(field);
    } else if (header in saved.fields) {
      mapping[header] = null;
    }
  }
  // Si una sugerencia choca con un campo de la relación guardada, gana la guardada.
  for (const header of headers) {
    const field = mapping[header];
    if (field && !(header in saved.fields) && used.has(field)) mapping[header] = null;
  }
  return mapping;
}

/** Asigna un campo a una columna y lo saca de cualquier otra que lo tuviera. */
export function assignField(mapping: Mapping, header: string, field: FieldKey | null): Mapping {
  const next: Mapping = {};
  for (const [h, f] of Object.entries(mapping)) next[h] = field !== null && f === field ? null : f;
  next[header] = isConfidentialHeader(header) ? null : field;
  return next;
}

export type RowInput = { rowNumber: number; values: Partial<Record<FieldKey, Cell>> };

/**
 * Arma las filas a importar con SOLO las columnas que tienen campo. Las demás,
 * y en especial las confidenciales, no viajan a la app.
 */
export function extractRows(sheet: SheetData, mapping: Mapping): RowInput[] {
  const columns = sheet.headers
    .map((header, index) => ({ index, field: isConfidentialHeader(header) ? null : (mapping[header] ?? null) }))
    .filter((c): c is { index: number; field: FieldKey } => c.field !== null);

  return sheet.rows.map((row, r) => {
    const values: Partial<Record<FieldKey, Cell>> = {};
    for (const { index, field } of columns) {
      // Para el link sirve el hipervínculo escondido detrás del texto.
      values[field] = field === 'pub.url' ? (sheet.links[r][index] ?? row[index]) : row[index];
    }
    return { rowNumber: sheet.rowNumbers[r], values };
  });
}

/** Primer valor no vacío de una columna, para mostrar de ejemplo. */
export function sampleValue(sheet: SheetData, columnIndex: number): string | null {
  for (const row of sheet.rows) {
    const v = row[columnIndex];
    if (v !== null && v !== '') return String(v);
  }
  return null;
}

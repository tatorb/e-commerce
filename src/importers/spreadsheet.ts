import Papa from 'papaparse';

// Lee un Excel (.xlsx) o un CSV y lo devuelve como tablas simples. Corre en
// el navegador: el archivo no se sube entero a la app.

export type Cell = string | number | boolean | null;

export type SheetData = {
  name: string;
  headers: string[];
  rows: Cell[][];
  // Link escondido detrás de cada celda, si tiene (por ejemplo "Abrir").
  links: (string | null)[][];
  // Número de fila en el archivo, para los mensajes ("Fila 23").
  rowNumbers: number[];
};

export type TableData = { fileName: string; sheets: SheetData[] };

export class SpreadsheetError extends Error {}

export async function readSpreadsheet(fileName: string, data: ArrayBuffer): Promise<TableData> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return { fileName, sheets: [readCsv(fileName, data)] };
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    return { fileName, sheets: await readXlsx(data) };
  }
  if (lower.endsWith('.xls')) {
    throw new SpreadsheetError('Ese formato de Excel es viejo. Guardalo como .xlsx o .csv y probá de nuevo.');
  }
  throw new SpreadsheetError('El archivo tiene que ser un Excel (.xlsx) o un CSV.');
}

// ───────────────────────────── CSV ─────────────────────────────

function decodeText(data: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^﻿/, '');
  } catch {
    // Excel en Windows guarda los CSV con otra codificación: así los acentos
    // no se rompen.
    return new TextDecoder('windows-1252').decode(data);
  }
}

function readCsv(fileName: string, data: ArrayBuffer): SheetData {
  const parsed = Papa.parse<string[]>(decodeText(data), { skipEmptyLines: false });
  const raw = parsed.data.map((row) => row.map((v) => (v.trim() === '' ? null : v.trim())));
  const rowNumbers = raw.map((_, i) => i + 1);
  return buildSheet(fileName.replace(/\.[^.]+$/, ''), raw, raw.map((r) => r.map(() => null)), rowNumbers);
}

// ───────────────────────────── Excel ─────────────────────────────

type ExcelCellValue =
  | null
  | undefined
  | number
  | string
  | boolean
  | Date
  | { text?: unknown; hyperlink?: string }
  | { richText: { text: string }[] }
  | { formula?: string; sharedFormula?: string; result?: unknown }
  | { error: string };

function cellToValue(value: ExcelCellValue): { value: Cell; link: string | null } {
  if (value === null || value === undefined) return { value: null, link: null };
  if (typeof value === 'number' || typeof value === 'boolean') return { value, link: null };
  if (typeof value === 'string') return { value: value.trim() === '' ? null : value.trim(), link: null };
  if (value instanceof Date) return { value: value.toISOString().slice(0, 10), link: null };
  if ('richText' in value) {
    const text = value.richText.map((r) => r.text).join('').trim();
    return { value: text || null, link: null };
  }
  if ('hyperlink' in value && typeof value.hyperlink === 'string') {
    const text = cellToValue(value.text as ExcelCellValue).value;
    return { value: text ?? value.hyperlink, link: value.hyperlink };
  }
  if ('result' in value) return cellToValue(value.result as ExcelCellValue);
  if ('error' in value) return { value: null, link: null };
  return { value: null, link: null };
}

async function loadExcelJs() {
  // En el navegador se carga recién cuando hace falta, porque pesa.
  const mod = await import('exceljs');
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

async function readXlsx(data: ArrayBuffer): Promise<SheetData[]> {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new SpreadsheetError('No se pudo leer el Excel. Revisá que no esté dañado o protegido con contraseña.');
  }

  const sheets: SheetData[] = [];
  workbook.eachSheet((ws) => {
    const raw: Cell[][] = [];
    const links: (string | null)[][] = [];
    const rowNumbers: number[] = [];
    const width = ws.columnCount;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: Cell[] = [];
      const rowLinks: (string | null)[] = [];
      for (let c = 1; c <= width; c++) {
        const cell = row.getCell(c);
        const parsed = cellToValue(cell.value as ExcelCellValue);
        // Un link puesto como hipervínculo de la celda, sin texto con formato.
        const link = parsed.link ?? (typeof cell.hyperlink === 'string' && cell.hyperlink ? cell.hyperlink : null);
        values.push(parsed.value);
        rowLinks.push(link);
      }
      raw.push(values);
      links.push(rowLinks);
      rowNumbers.push(rowNumber);
    });
    if (raw.length > 0) sheets.push(buildSheet(ws.name, raw, links, rowNumbers));
  });
  if (sheets.length === 0) throw new SpreadsheetError('El Excel no tiene hojas con datos.');
  return sheets;
}

// ───────────────────────────── Común ─────────────────────────────

const filledCount = (row: Cell[]) => row.filter((v) => v !== null && v !== '').length;

/**
 * Busca la fila de encabezados entre las primeras 20: la primera con al
 * menos la mitad de las columnas completas. Así se saltean los títulos que
 * algunas planillas tienen arriba.
 */
function findHeaderRow(raw: Cell[][]): number {
  const sample = raw.slice(0, 20);
  const max = Math.max(0, ...sample.map(filledCount));
  const threshold = Math.max(2, Math.ceil(max / 2));
  const index = sample.findIndex((row) => filledCount(row) >= threshold);
  return index === -1 ? 0 : index;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildSheet(name: string, raw: Cell[][], links: (string | null)[][], rowNumbers: number[]): SheetData {
  const h = findHeaderRow(raw);
  const headerCells = raw[h] ?? [];
  const width = Math.max(headerCells.length, ...raw.map((r) => r.length));

  // Encabezados sin nombre o repetidos se distinguen, para poder elegirlos.
  const seen = new Map<string, number>();
  const headers: string[] = [];
  for (let c = 0; c < width; c++) {
    const v = headerCells[c];
    let header = v === null || v === undefined || String(v).trim() === '' ? `Columna ${columnLetter(c)}` : String(v).trim();
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    if (count > 0) header = `${header} (${count + 1})`;
    headers.push(header);
  }

  const rows: Cell[][] = [];
  const outLinks: (string | null)[][] = [];
  const outNumbers: number[] = [];
  for (let r = h + 1; r < raw.length; r++) {
    if (filledCount(raw[r]) === 0) continue;
    rows.push(Array.from({ length: width }, (_, c) => raw[r][c] ?? null));
    outLinks.push(Array.from({ length: width }, (_, c) => links[r]?.[c] ?? null));
    outNumbers.push(rowNumbers[r]);
  }
  return { name, headers, rows, links: outLinks, rowNumbers: outNumbers };
}

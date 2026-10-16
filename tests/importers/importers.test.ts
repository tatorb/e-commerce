import { describe, expect, it } from 'vitest';
import { mercadolibre } from '@/channels/mercadolibre';
import { isConfidentialHeader } from '@/importers/fields';
import {
  applySavedMapping,
  assignField,
  extractRows,
  findSavedMapping,
  suggestMapping,
} from '@/importers/mapping';
import { readSpreadsheet } from '@/importers/spreadsheet';
import { splitSkus, toRecord } from '@/importers/transform';
import { classifyRecords } from '@/importers/classify';
import { BASE_HEADERS, CONFIDENTIAL_VALUES, buildWorkbook } from './fixture';

async function baseSheet() {
  const table = await readSpreadsheet('auditoria.xlsx', await buildWorkbook());
  const sheet = table.sheets.find((s) => s.name === 'Base');
  if (!sheet) throw new Error('falta la hoja Base');
  return { table, sheet };
}

describe('lectura de Excel', () => {
  it('lee todas las hojas y encuentra los encabezados', async () => {
    const { table, sheet } = await baseSheet();
    expect(table.sheets.map((s) => s.name)).toEqual(['Resumen', 'Base']);
    expect(sheet.headers).toEqual(BASE_HEADERS);
    expect(sheet.rows).toHaveLength(5);
    expect(sheet.rowNumbers).toEqual([2, 3, 4, 5, 6]);
    // En la hoja con título arriba, los encabezados están en la fila 3.
    expect(table.sheets[0].headers).toEqual(['Indicador', 'Valor', 'Nota']);
  });

  it('guarda el link escondido detrás de "Abrir"', async () => {
    const { sheet } = await baseSheet();
    expect(sheet.rows[0][1]).toBe('Abrir');
    expect(sheet.links[0][1]).toContain('item_id:MLA1000000001');
  });
});

describe('lectura de CSV', () => {
  it('detecta punto y coma y los acentos de Excel en Windows', async () => {
    const text = 'ID publicación;Título;Link\nMLA1000000009;Kit de distribución;Abrir\n';
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0)));
    const table = await readSpreadsheet('base.csv', bytes.buffer);
    const [sheet] = table.sheets;
    expect(sheet.headers).toEqual(['ID publicación', 'Título', 'Link']);
    expect(sheet.rows[0]).toEqual(['MLA1000000009', 'Kit de distribución', 'Abrir']);
  });
});

describe('propuesta de columnas', () => {
  it('propone los campos conocidos y traba las confidenciales', () => {
    const m = suggestMapping(BASE_HEADERS);
    expect(m['ID publicación']).toBe('pub.externalId');
    expect(m['Link']).toBe('pub.url');
    expect(m['Título']).toBe('pub.title');
    expect(m['Nº de pieza']).toBe('product.partNumber');
    expect(m['Marca del vehículo']).toBe('compat.vehicleBrand');
    expect(m['Precio ($)']).toBe('pub.price');
    expect(m['Fotos']).toBe('metric.photo_count');
    expect(m['Clip']).toBe('metric.has_video');
    expect(m['Visitas 90 días']).toBe('metric.visits_90d');
    expect(m['SKU']).toBe('product.skus');
    expect(m['Estado']).toBe('pub.channelStatus');
    expect(m['Precio lista proveedor con IVA ($)']).toBeNull();
    expect(m['Recibís ($)']).toBeNull();
    expect(m['Puntaje calidad (100)']).toBeNull();
    expect(isConfidentialHeader('Precio lista proveedor con IVA ($)')).toBe(true);
    expect(isConfidentialHeader('Facturación 90 días ($)')).toBe(true);
    expect(isConfidentialHeader('Precio ($)')).toBe(false);
  });

  it('no deja asignar un campo a una columna confidencial', () => {
    const m = assignField(suggestMapping(BASE_HEADERS), 'Recibís ($)', 'pub.price');
    expect(m['Recibís ($)']).toBeNull();
  });

  it('un campo queda en una sola columna', () => {
    const m = assignField(suggestMapping(BASE_HEADERS), 'Puntaje calidad (100)', 'pub.title');
    expect(m['Puntaje calidad (100)']).toBe('pub.title');
    expect(m['Título']).toBeNull();
  });

  it('reconoce una relación guardada y la aplica', () => {
    const saved = {
      id: 'm1',
      name: 'Auditoría',
      headers: BASE_HEADERS,
      fields: { Título: 'product.name', 'Puntaje calidad (100)': 'product.notes', Motor: '' },
    };
    expect(findSavedMapping(BASE_HEADERS, [saved])?.id).toBe('m1');
    expect(findSavedMapping(['Otra', 'Cosa'], [saved])).toBeNull();
    const m = applySavedMapping(BASE_HEADERS, saved);
    expect(m['Título']).toBe('product.name');
    expect(m['Puntaje calidad (100)']).toBe('product.notes');
    expect(m['Motor']).toBeNull();
    expect(m['ID publicación']).toBe('pub.externalId');
  });
});

describe('filas a importar', () => {
  it('las columnas confidenciales no viajan', async () => {
    const { sheet } = await baseSheet();
    const rows = extractRows(sheet, suggestMapping(sheet.headers));
    const json = JSON.stringify(rows);
    for (const value of CONFIDENTIAL_VALUES) expect(json).not.toContain(String(value));
    expect(rows[0].values['pub.url']).toContain('item_id:MLA1000000001');
  });

  it('traduce cada fila a producto, publicación y medición', async () => {
    const { sheet } = await baseSheet();
    const records = extractRows(sheet, suggestMapping(sheet.headers)).map((r) => toRecord(r, mercadolibre));
    const [first, second, unpublished, noTitle, odd] = records;

    expect(first.error).toBeNull();
    expect(first.product?.name).toBe('Subconjunto de prueba 1.6');
    expect(first.product?.warranty).toBeNull();
    expect(first.product?.variants).toEqual([
      { measure: null, sku: 'PA-1-00' },
      { measure: null, sku: 'PA-1-50' },
    ]);
    expect(first.product?.compatibilities[0]).toMatchObject({ vehicleBrand: 'Ford', engine: '1.6 8v' });
    expect(first.publication).toMatchObject({
      externalId: 'MLA1000000001',
      price: 99999,
      channelStatus: 'ACTIVE',
    });
    expect(first.metrics).toEqual({ photo_count: 4, has_video: true, visits_90d: 136, conversion_90d: 0.0073 });
    expect(first.warnings).toEqual([]);

    expect(second.publication.channelStatus).toBe('PAUSED');
    expect(second.product?.warranty).toBe('30 días de garantía');

    expect(unpublished.publication.externalId).toBeNull();
    expect(unpublished.publication.channelStatus).toBe('UNPUBLISHED');
    expect(unpublished.warnings).toEqual([]);

    expect(noTitle.error).toBe('Falta el título o el nombre del producto.');

    expect(odd.publication.channelStatus).toBe('ACTIVE');
    expect(odd.publication.price).toBe(125000);
    expect(odd.warnings[0]).toContain('«Rara»');
  });

  it('clasifica las filas como en la importación', async () => {
    const { sheet } = await baseSheet();
    const records = extractRows(sheet, suggestMapping(sheet.headers)).map((r) => toRecord(r, mercadolibre));
    const empty = classifyRecords(records, { externalIds: [], skus: {} });
    expect(empty.actions).toEqual(['new', 'link', 'new', 'error', 'new']);
    expect(empty.summary).toMatchObject({ newProducts: 3, linked: 1, existing: 0, errors: 1, withWarnings: 1 });

    const again = classifyRecords(records, {
      externalIds: ['MLA1000000001', 'MLA1000000002', 'MLA1000000004'],
      skus: {
        'PA-1-00': { hasPublicationWithoutId: false },
        'PA-1-50': { hasPublicationWithoutId: false },
        'SP-000 STD': { hasPublicationWithoutId: true },
        'PD-1': { hasPublicationWithoutId: false },
      },
    });
    expect(again.actions).toEqual(['existing', 'existing', 'existing', 'error', 'existing']);
  });

  it('separa los SKU múltiples', () => {
    expect(splitSkus('A-1 / A-2')).toEqual(['A-1', 'A-2']);
    expect(splitSkus('A-1; A-2;A-1')).toEqual(['A-1', 'A-2']);
    expect(splitSkus('SP-460-50-00')).toEqual(['SP-460-50-00']);
    expect(splitSkus('')).toEqual([]);
  });
});

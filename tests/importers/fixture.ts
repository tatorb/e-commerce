import ExcelJS from 'exceljs';

// Excel inventado con la forma de una planilla de auditoría. Ningún dato es
// real: los valores de las columnas confidenciales sirven para comprobar
// que nunca llegan a la app.

export const CONFIDENTIAL_VALUES = [987654321, 876543210];

export const BASE_HEADERS = [
  'ID publicación',
  'Link',
  'Título',
  'Marca del repuesto',
  'Nº de pieza',
  'Tipo de producto',
  'Marca del vehículo',
  'Motor',
  'Precio ($)',
  'Fotos',
  'Clip',
  'Garantía',
  'Visitas 90 días',
  'Conversión 90 días',
  'SKU',
  'Estado',
  'Precio lista proveedor con IVA ($)',
  'Recibís ($)',
  'Puntaje calidad (100)',
];

const link = (id: string) => ({
  text: 'Abrir',
  hyperlink: `https://www.mercadolibre.com.ar/up/MLAU9999?pdp_filters=item_id:${id}`,
});

export const BASE_ROWS: unknown[][] = [
  ['MLA1000000001', link('MLA1000000001'), 'Subconjunto de prueba 1.6', 'Marca A', 'PA-1', 'Subconjunto', 'Ford', '1.6 8v', 99999, 4, 'Sí', 'No informa', 136, 0.0073, 'PA-1-00 / PA-1-50', 'Activa', CONFIDENTIAL_VALUES[0], CONFIDENTIAL_VALUES[1], 72],
  ['MLA1000000002', link('MLA1000000002'), 'Subconjunto de prueba 1.6', 'Marca A', 'PA-1', 'Subconjunto', 'Ford', '1.6 8v', 88888, 3, 'No', '30 días de garantía', 10, 0, 'PA-1-00', 'Pausada', CONFIDENTIAL_VALUES[0], CONFIDENTIAL_VALUES[1], 60],
  ['SP-000 STD', null, 'Producto sin publicar', 'Marca B', null, 'Camisas', null, null, null, null, null, null, null, null, 'SP-000 STD', 'Sin publicar', CONFIDENTIAL_VALUES[0], null, null],
  ['MLA1000000003', link('MLA1000000003'), null, 'Marca C', null, null, null, null, null, null, null, null, null, null, 'PC-1', 'Activa', null, null, null],
  ['MLA1000000004', link('MLA1000000004'), 'Kit de prueba', 'Marca D', 'PD-1', 'Kit de embrague', 'Fiat', null, '125.000', 6, 'Sí', '15 días de garantía', 5, null, 'PD-1', 'Rara', null, null, 80],
];

export async function buildWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const resumen = wb.addWorksheet('Resumen');
  resumen.addRow(['Auditoría de prueba']);
  resumen.addRow([]);
  resumen.addRow(['Indicador', 'Valor', 'Nota']);
  resumen.addRow(['Publicaciones', 5, null]);

  const base = wb.addWorksheet('Base');
  base.addRow(BASE_HEADERS);
  for (const row of BASE_ROWS) base.addRow(row);

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer).buffer;
}

import type { ImportRecord } from './transform';

// Qué va a pasar con cada fila antes de importar, para la revisión. Sigue
// las mismas reglas que la importación (src/importers/apply.ts):
//   1. si ya hay una publicación con ese ID en la tienda, no se toca;
//   2. si algún SKU coincide con un producto, se le suma la publicación;
//   3. si no, se crea un producto nuevo.
// También tiene en cuenta las filas anteriores del mismo archivo.

export type RowAction = 'existing' | 'link' | 'new' | 'error';

export type ExistingKeys = {
  // IDs de publicación que ya existen en la tienda.
  externalIds: string[];
  // SKU (en mayúsculas) de productos que ya existen en la cuenta, y si ese
  // producto ya tiene una publicación sin ID en la tienda.
  skus: Record<string, { hasPublicationWithoutId: boolean }>;
};

export type Classification = {
  actions: RowAction[];
  summary: {
    newProducts: number;
    linked: number;
    existing: number;
    errors: number;
    withWarnings: number;
    withMetrics: number;
  };
};

export function classifyRecords(records: ImportRecord[], existing: ExistingKeys): Classification {
  const ids = new Set(existing.externalIds);
  const skuInfo = new Map(Object.entries(existing.skus));
  const actions: RowAction[] = [];
  const summary = { newProducts: 0, linked: 0, existing: 0, errors: 0, withWarnings: 0, withMetrics: 0 };

  for (const r of records) {
    if (r.warnings.length > 0) summary.withWarnings++;
    if (r.error || !r.product) {
      actions.push('error');
      summary.errors++;
      continue;
    }
    if (Object.keys(r.metrics).length > 0) summary.withMetrics++;

    const id = r.publication.externalId;
    const skus = r.skus.map((s) => s.toUpperCase());
    const match = skus.map((s) => skuInfo.get(s)).find(Boolean);

    let action: RowAction;
    if (id && ids.has(id)) action = 'existing';
    else if (!id && match?.hasPublicationWithoutId) action = 'existing';
    else if (match) action = 'link';
    else action = 'new';

    actions.push(action);
    if (action === 'new') summary.newProducts++;
    else if (action === 'link') summary.linked++;
    else summary.existing++;

    // Lo que crea esta fila cuenta para las siguientes.
    if (id) ids.add(id);
    for (const s of skus) {
      const prev = skuInfo.get(s);
      skuInfo.set(s, { hasPublicationWithoutId: (prev?.hasPublicationWithoutId ?? false) || !id });
    }
  }
  return { actions, summary };
}

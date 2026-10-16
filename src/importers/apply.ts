import { z } from 'zod';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelAdapter } from '@/channels/types';
import {
  isContentField,
  isPublicationField,
  loadContent,
  planContentUpdate,
  readContentField,
  sameValue,
  writeContentField,
  type ContentField,
  type ContentSnapshot,
  type UpdateMode,
} from '@/domain/content';
import { writeProduct } from '@/domain/products';
import { insertPublication, publicationDataSchema } from '@/domain/publications';
import { isFieldKey, type FieldKey } from './fields';
import type { RowInput } from './mapping';
import type { Cell } from './spreadsheet';
import { toRecord, type ImportRecord } from './transform';

// Guarda en la base las filas ya traducidas. Cada fila va en su propia
// transacción: si una falla, las demás siguen. Las reglas son las mismas que
// muestra la revisión (src/importers/classify.ts). A lo que ya estaba solo se
// le completan campos, nunca se le borra nada (src/domain/content.ts).

export type ApplyContext = {
  accountId: string;
  storeId: string;
  adapter: ChannelAdapter;
  runId: string;
  userId: string | null;
  dataDate: Date;
  // Qué hacer con lo que ya está: solo completar lo vacío, o también reemplazar.
  mode?: UpdateMode;
};

export type ApplyResult = {
  processed: number;
  productsCreated: number;
  publicationsCreated: number;
  publicationsLinked: number;
  publicationsExisting: number;
  publicationsUpdated: number;
  fieldsChanged: number;
  measurementsSaved: number;
  errors: { row: number; message: string }[];
};

const cellSchema = z.union([z.string().max(50000), z.number(), z.boolean(), z.null()]);

/** Valida lo que llega del navegador y descarta cualquier clave que no sea un campo. */
export const rowsInputSchema = z
  .array(z.object({ rowNumber: z.number().int().nonnegative(), values: z.record(z.string(), cellSchema) }))
  .max(200)
  .transform((rows): RowInput[] =>
    rows.map((r) => {
      const values: Partial<Record<FieldKey, Cell>> = {};
      for (const [k, v] of Object.entries(r.values)) if (isFieldKey(k)) values[k] = v;
      return { rowNumber: r.rowNumber, values };
    }),
  );

/** Publicación o producto que ya está en la app para esta fila, si hay. */
async function findExisting(
  tx: Prisma.TransactionClient,
  ctx: { accountId: string; storeId: string },
  record: ImportRecord,
): Promise<{ productId: string; publicationId: string | null } | null> {
  const externalId = record.publication.externalId;
  // 1. Publicación con el mismo ID en la tienda.
  if (externalId) {
    const pub = await tx.publication.findFirst({
      where: { storeId: ctx.storeId, externalId },
      select: { id: true, productId: true },
    });
    if (pub) return { productId: pub.productId, publicationId: pub.id };
  }
  // 2. Producto con algún SKU igual.
  if (record.skus.length === 0) return null;
  const match = await tx.product.findFirst({
    where: {
      accountId: ctx.accountId,
      variants: {
        some: { OR: record.skus.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' as const } })) },
      },
    },
    select: { id: true },
  });
  if (!match) return null;
  // Sin ID, la publicación de ese producto en la tienda es la misma.
  if (!externalId) {
    const pub = await tx.publication.findFirst({
      where: { productId: match.id, storeId: ctx.storeId, externalId: null },
      select: { id: true },
    });
    if (pub) return { productId: match.id, publicationId: pub.id };
  }
  return { productId: match.id, publicationId: null };
}

const asJson = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

export async function applyRows(db: PrismaClient, ctx: ApplyContext, rows: RowInput[]): Promise<ApplyResult> {
  const mode = ctx.mode ?? 'FILL_EMPTY';
  const result: ApplyResult = {
    processed: 0,
    productsCreated: 0,
    publicationsCreated: 0,
    publicationsLinked: 0,
    publicationsExisting: 0,
    publicationsUpdated: 0,
    fieldsChanged: 0,
    measurementsSaved: 0,
    errors: [],
  };

  for (const row of rows) {
    result.processed++;
    const record = toRecord(row, ctx.adapter);
    if (record.error || !record.product) {
      result.errors.push({ row: record.rowNumber, message: record.error ?? 'Datos inválidos.' });
      continue;
    }
    const publicationData = publicationDataSchema.safeParse({
      ...record.publication,
      title: record.publication.title ?? '',
      description: record.publication.description ?? '',
      attributes: [],
    });
    if (!publicationData.success) {
      result.errors.push({
        row: record.rowNumber,
        message: publicationData.error.issues[0]?.message ?? 'Datos de la publicación inválidos.',
      });
      continue;
    }
    const product = record.product;

    try {
      const outcome = await db.$transaction(async (tx) => {
        const found = await findExisting(tx, ctx, record);
        let kind: 'existing' | 'link' | 'new';
        let publicationId: string;
        let changed = 0;

        if (found?.publicationId) {
          kind = 'existing';
          publicationId = found.publicationId;
        } else {
          // Si no hay coincidencia, producto nuevo.
          kind = found ? 'link' : 'new';
          const productId =
            found?.productId ??
            (
              await writeProduct(tx, {
                accountId: ctx.accountId,
                productId: null,
                data: product,
                source: 'IMPORT',
                importRunId: ctx.runId,
              })
            ).id;
          publicationId = (
            await insertPublication(tx, {
              productId,
              storeId: ctx.storeId,
              data: publicationData.data,
              userId: ctx.userId,
              source: 'IMPORT',
              importRunId: ctx.runId,
            })
          ).id;
        }

        // Lo que ya estaba: se completa con lo que trae la fila, y cada cambio
        // queda anotado para poder deshacerlo.
        if (found) {
          const target = { productId: found.productId, publicationId: found.publicationId };
          const current = await loadContent(tx, target.productId, target.publicationId);
          const { changes } = planContentUpdate(current, record.content, mode, {
            publication: target.publicationId !== null,
          });
          for (const change of changes) {
            await writeContentField(tx, target, change.field, change.after);
            await tx.importChange.create({
              data: {
                importRunId: ctx.runId,
                productId: target.productId,
                publicationId: isPublicationField(change.field) ? target.publicationId : null,
                field: change.field,
                before: asJson(change.before),
                after: asJson(change.after),
              },
            });
          }
          changed = changes.length;
        }

        // La medición de esa fecha: si ya estaba, se reemplaza.
        let measured = false;
        if (Object.keys(record.metrics).length > 0) {
          await tx.measurement.upsert({
            where: { publicationId_takenAt: { publicationId, takenAt: ctx.dataDate } },
            create: {
              publicationId,
              takenAt: ctx.dataDate,
              source: 'IMPORT',
              metrics: record.metrics,
              importRunId: ctx.runId,
            },
            // Sigue ligada a la importación que la creó: deshacer una
            // reimportación no borra mediciones de antes.
            update: { metrics: record.metrics, source: 'IMPORT' },
          });
          measured = true;
        }
        return { kind, measured, changed };
      });

      if (outcome.kind === 'new') {
        result.productsCreated++;
        result.publicationsCreated++;
      } else if (outcome.kind === 'link') {
        result.publicationsCreated++;
        result.publicationsLinked++;
      } else {
        result.publicationsExisting++;
      }
      if (outcome.changed > 0) {
        result.publicationsUpdated++;
        result.fieldsChanged += outcome.changed;
      }
      if (outcome.measured) result.measurementsSaved++;
    } catch (e) {
      console.error('Error al importar la fila', record.rowNumber, e instanceof Error ? e.message : e);
      result.errors.push({ row: record.rowNumber, message: 'No se pudo guardar esta fila.' });
    }
  }
  return result;
}

export type RowPreview = {
  rowNumber: number;
  // Campos que cambian solo completando lo vacío.
  fill: ContentField[];
  // Campos que además cambian si se elige reemplazar.
  replace: ContentField[];
  warnings: string[];
};

/**
 * Qué cambiaría en lo que ya está en la app, sin guardar nada. Usa la misma
 * comparación que la importación.
 */
export async function previewRows(
  db: PrismaClient,
  ctx: { accountId: string; storeId: string; adapter: ChannelAdapter },
  rows: RowInput[],
): Promise<RowPreview[]> {
  const previews: RowPreview[] = [];
  for (const row of rows) {
    const record = toRecord(row, ctx.adapter);
    if (record.error || !record.product) continue;
    const found = await findExisting(db, ctx, record);
    if (!found) continue;
    const current = await loadContent(db, found.productId, found.publicationId);
    const opts = { publication: found.publicationId !== null };
    const fill = planContentUpdate(current, record.content, 'FILL_EMPTY', opts);
    const replace = planContentUpdate(current, record.content, 'REPLACE', opts);
    const fillAfter = new Map(fill.changes.map((c) => [c.field, c.after]));
    previews.push({
      rowNumber: record.rowNumber,
      fill: fill.changes.map((c) => c.field),
      replace: replace.changes
        .filter((c) => !fillAfter.has(c.field) || !sameValue(fillAfter.get(c.field), c.after))
        .map((c) => c.field),
      warnings: replace.warnings,
    });
  }
  return previews;
}

/**
 * Deshace una importación. Primero devuelve los campos que cambió en lo que
 * ya estaba, del último cambio al primero, salvo los que alguien cambió
 * después. Después borra las mediciones, publicaciones y productos que creó.
 */
export async function undoImportRun(
  db: PrismaClient,
  args: { runId: string; accountId: string },
): Promise<{ products: number; publications: number; measurements: number; restored: number; kept: number }> {
  const run = await db.importRun.findFirst({ where: { id: args.runId, accountId: args.accountId } });
  if (!run) throw new Error('La importación no existe en esta cuenta.');
  if (run.status === 'UNDONE') return { products: 0, publications: 0, measurements: 0, restored: 0, kept: 0 };

  const changes = await db.importChange.findMany({ where: { importRunId: run.id }, orderBy: { id: 'desc' } });
  const byProduct = new Map<string, typeof changes>();
  for (const c of changes) byProduct.set(c.productId, [...(byProduct.get(c.productId) ?? []), c]);

  let restored = 0;
  let kept = 0;
  // Una transacción por producto: si se corta, volver a deshacer sigue de
  // donde quedó, porque lo ya devuelto no coincide más con "cómo quedó".
  for (const [productId, list] of byProduct) {
    await db.$transaction(async (tx) => {
      const snapshots = new Map<string, ContentSnapshot>();
      const snapshotFor = async (publicationId: string | null) => {
        const key = publicationId ?? '';
        if (!snapshots.has(key)) snapshots.set(key, await loadContent(tx, productId, publicationId));
        return snapshots.get(key)!;
      };
      for (const c of list) {
        if (!isContentField(c.field)) continue;
        const snapshot = await snapshotFor(c.publicationId);
        if (!sameValue(readContentField(snapshot, c.field), c.after)) {
          kept++;
          continue;
        }
        await writeContentField(tx, { productId, publicationId: c.publicationId }, c.field, c.before);
        // Las fotos guardadas de este producto se actualizan con lo devuelto.
        for (const s of snapshots.values()) {
          if (!isPublicationField(c.field) || s === snapshot) (s as Record<string, unknown>)[c.field] = c.before;
        }
        restored++;
      }
    });
  }

  const deleted = await db.$transaction(async (tx) => {
    const measurements = await tx.measurement.deleteMany({ where: { importRunId: run.id } });
    const publications = await tx.publication.deleteMany({ where: { importRunId: run.id } });
    const products = await tx.product.deleteMany({ where: { importRunId: run.id } });
    await tx.importRun.update({ where: { id: run.id }, data: { status: 'UNDONE', undoneAt: new Date() } });
    return { products: products.count, publications: publications.count, measurements: measurements.count };
  });
  return { ...deleted, restored, kept };
}

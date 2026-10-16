import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelAdapter } from '@/channels/types';
import { writeProduct } from '@/domain/products';
import { insertPublication, publicationDataSchema } from '@/domain/publications';
import { isFieldKey, type FieldKey } from './fields';
import type { RowInput } from './mapping';
import type { Cell } from './spreadsheet';
import { toRecord } from './transform';

// Guarda en la base las filas ya traducidas. Cada fila va en su propia
// transacción: si una falla, las demás siguen. Las reglas son las mismas que
// muestra la revisión (src/importers/classify.ts).

export type ApplyContext = {
  accountId: string;
  storeId: string;
  adapter: ChannelAdapter;
  runId: string;
  userId: string | null;
  dataDate: Date;
};

export type ApplyResult = {
  processed: number;
  productsCreated: number;
  publicationsCreated: number;
  publicationsLinked: number;
  publicationsExisting: number;
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

export async function applyRows(db: PrismaClient, ctx: ApplyContext, rows: RowInput[]): Promise<ApplyResult> {
  const result: ApplyResult = {
    processed: 0,
    productsCreated: 0,
    publicationsCreated: 0,
    publicationsLinked: 0,
    publicationsExisting: 0,
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
    const externalId = record.publication.externalId;

    try {
      const outcome = await db.$transaction(async (tx) => {
        // 1. Publicación con el mismo ID en la tienda: no se toca.
        let publicationId: string | null = null;
        if (externalId) {
          const pub = await tx.publication.findFirst({
            where: { storeId: ctx.storeId, externalId },
            select: { id: true },
          });
          publicationId = pub?.id ?? null;
        }

        let kind: 'existing' | 'link' | 'new' = 'existing';
        if (!publicationId) {
          // 2. Producto con algún SKU igual.
          const match =
            record.skus.length > 0
              ? await tx.product.findFirst({
                  where: {
                    accountId: ctx.accountId,
                    variants: {
                      some: { OR: record.skus.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' as const } })) },
                    },
                  },
                  select: { id: true },
                })
              : null;

          // Sin ID, la publicación de ese producto en la tienda es la misma.
          if (match && !externalId) {
            const pub = await tx.publication.findFirst({
              where: { productId: match.id, storeId: ctx.storeId, externalId: null },
              select: { id: true },
            });
            publicationId = pub?.id ?? null;
          }

          if (!publicationId) {
            // 3. Si no hay coincidencia, producto nuevo.
            let productId = match?.id;
            if (productId) {
              kind = 'link';
            } else {
              kind = 'new';
              productId = (
                await writeProduct(tx, {
                  accountId: ctx.accountId,
                  productId: null,
                  data: product,
                  source: 'IMPORT',
                  importRunId: ctx.runId,
                })
              ).id;
            }
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
        return { kind, measured };
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
      if (outcome.measured) result.measurementsSaved++;
    } catch (e) {
      console.error('Error al importar la fila', record.rowNumber, e instanceof Error ? e.message : e);
      result.errors.push({ row: record.rowNumber, message: 'No se pudo guardar esta fila.' });
    }
  }
  return result;
}

/**
 * Deshace una importación: borra las mediciones, publicaciones y productos
 * que creó. Lo que había antes no se toca.
 */
export async function undoImportRun(
  db: PrismaClient,
  args: { runId: string; accountId: string },
): Promise<{ products: number; publications: number; measurements: number }> {
  return db.$transaction(async (tx) => {
    const run = await tx.importRun.findFirst({ where: { id: args.runId, accountId: args.accountId } });
    if (!run) throw new Error('La importación no existe en esta cuenta.');
    if (run.status === 'UNDONE') return { products: 0, publications: 0, measurements: 0 };

    const measurements = await tx.measurement.deleteMany({ where: { importRunId: run.id } });
    const publications = await tx.publication.deleteMany({ where: { importRunId: run.id } });
    const products = await tx.product.deleteMany({ where: { importRunId: run.id } });
    await tx.importRun.update({ where: { id: run.id }, data: { status: 'UNDONE', undoneAt: new Date() } });
    return { products: products.count, publications: publications.count, measurements: measurements.count };
  });
}

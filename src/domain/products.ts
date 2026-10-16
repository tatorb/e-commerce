import { z } from 'zod';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { RecordSource } from '@/generated/prisma/enums';
import { withEngineData } from './engine';
import { compactNameValues, nameValueSchema } from './name-value';

// Ficha maestra del producto. Este módulo no sabe nada de canales ni de
// archivos: recibe datos ya limpios y los guarda.

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const year = z
  .union([z.string(), z.number(), z.null()])
  .transform((v, ctx) => {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!Number.isInteger(n) || n < 1900 || n > 2100) {
      ctx.addIssue({ code: 'custom', message: 'El año tiene que ser un número, por ejemplo 2012.' });
      return z.NEVER;
    }
    return n;
  });

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre para el producto.').max(300),
  brand: text(200),
  partNumber: text(200),
  productType: text(200),
  engineSystem: text(200),
  line: text(200),
  origin: text(200),
  warranty: text(500),
  kitContents: text(5000),
  notes: text(5000),
  specs: z.array(nameValueSchema).max(200),
  variants: z
    .array(z.object({ measure: text(100), sku: text(200) }))
    .max(100),
  compatibilities: z
    .array(
      z
        .object({
          vehicleBrand: text(200),
          model: text(200),
          engine: text(200),
          // Vacíos o sin venir, se sacan del motor.
          displacement: optionalText(20),
          fuel: optionalText(40),
          yearFrom: year,
          yearTo: year,
          note: text(500),
        })
        .refine((c) => c.yearFrom === null || c.yearTo === null || c.yearFrom <= c.yearTo, {
          message: 'El año desde no puede ser mayor que el año hasta.',
        }),
    )
    .max(500),
  assets: z
    .array(
      z.object({
        kind: z.enum(['PHOTO', 'VIDEO']),
        url: z.string().trim().refine(isHttpUrl, 'El link tiene que empezar con http:// o https://'),
      }),
    )
    .max(100),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

/** Saca las filas que el formulario deja vacías, antes de validar. */
export function dropEmptyRows(input: ProductInput): ProductInput {
  const filled = (values: unknown[]) =>
    values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
  return {
    ...input,
    specs: compactNameValues(input.specs.map((s) => ({ name: s.name.trim(), value: s.value.trim() }))),
    variants: input.variants.filter((v) => filled([v.measure, v.sku])),
    compatibilities: input.compatibilities.filter((c) =>
      filled([c.vehicleBrand, c.model, c.engine, c.displacement, c.fuel, c.yearFrom, c.yearTo, c.note]),
    ),
    assets: input.assets.filter((a) => filled([a.url])),
  };
}

type Tx = Prisma.TransactionClient;

type SaveArgs = {
  accountId: string;
  productId: string | null;
  data: ProductData;
  source?: RecordSource;
  importRunId?: string | null;
};

/**
 * Crea o actualiza un producto con todas sus partes. Las medidas,
 * compatibilidades y activos se reemplazan enteros: lo que llega es la
 * versión completa.
 */
export async function saveProduct(db: PrismaClient, args: SaveArgs): Promise<{ id: string }> {
  return db.$transaction((tx) => writeProduct(tx, args));
}

/** Lo mismo que saveProduct, dentro de una transacción que ya está abierta. */
export async function writeProduct(tx: Tx, args: SaveArgs): Promise<{ id: string }> {
  const { accountId, productId, data } = args;
  const fields = {
    name: data.name,
    brand: data.brand,
    partNumber: data.partNumber,
    productType: data.productType,
    engineSystem: data.engineSystem,
    line: data.line,
    origin: data.origin,
    warranty: data.warranty,
    kitContents: data.kitContents,
    notes: data.notes,
    specs: data.specs,
  };

  let id: string;
  if (productId) {
    const existing = await tx.product.findFirst({ where: { id: productId, accountId }, select: { id: true } });
    if (!existing) throw new Error('El producto no existe en esta cuenta.');
    id = existing.id;
    await tx.product.update({ where: { id }, data: fields });
    await tx.productVariant.deleteMany({ where: { productId: id } });
    await tx.compatibility.deleteMany({ where: { productId: id } });
    await tx.asset.deleteMany({ where: { productId: id } });
  } else {
    const created = await tx.product.create({
      data: {
        ...fields,
        accountId,
        source: args.source ?? RecordSource.MANUAL,
        importRunId: args.importRunId ?? null,
      },
      select: { id: true },
    });
    id = created.id;
  }

  if (data.variants.length > 0) {
    await tx.productVariant.createMany({
      data: data.variants.map((v, position) => ({ ...v, productId: id, position })),
    });
  }
  if (data.compatibilities.length > 0) {
    await tx.compatibility.createMany({
      data: data.compatibilities.map((c, position) => ({ ...withEngineData(c), productId: id, position })),
    });
  }
  if (data.assets.length > 0) {
    await tx.asset.createMany({
      data: data.assets.map((a, position) => ({ ...a, productId: id, position })),
    });
  }
  return { id };
}

import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { withEngineData } from './engine';
import { productInputSchema } from './products';

// Los datos de la ficha que se editan desde el paso Información: tipo de
// producto, marca, número de pieza, línea, origen, medidas y compatibilidades. Se
// guardan en la ficha maestra, que sigue siendo la única fuente.

const s = productInputSchema.shape;

export const productInfoSchema = z.object({
  productType: s.productType,
  brand: s.brand,
  partNumber: s.partNumber,
  line: s.line,
  // Sin mandar, queda como está.
  origin: s.origin.optional(),
  // Con su id las que ya estaban, así no se pierden las referencias a cada medida.
  variants: z
    .array(z.object({ id: z.string().nullable(), measure: s.variants.element.shape.measure, sku: s.variants.element.shape.sku }))
    .max(100),
  compatibilities: s.compatibilities,
});

export type ProductInfoInput = z.input<typeof productInfoSchema>;
export type ProductInfo = z.output<typeof productInfoSchema>;

type Tx = Prisma.TransactionClient;

export async function updateProductInfo(tx: Tx, args: { accountId: string; productId: string; data: ProductInfo }) {
  const { productId, data } = args;
  const product = await tx.product.findFirst({ where: { id: productId, accountId: args.accountId }, select: { id: true } });
  if (!product) throw new Error('El producto no existe en esta cuenta.');
  await tx.product.update({
    where: { id: productId },
    data: { productType: data.productType, brand: data.brand, partNumber: data.partNumber, line: data.line, origin: data.origin },
  });

  // Medidas: se actualizan en su lugar, se suman las nuevas y se borran las que se sacaron.
  const existing = new Set(
    (await tx.productVariant.findMany({ where: { productId }, select: { id: true } })).map((v) => v.id),
  );
  const rows = data.variants.filter((v) => v.measure !== null || v.sku !== null);
  const keep = rows.flatMap((v) => (v.id && existing.has(v.id) ? [v.id] : []));
  await tx.productVariant.deleteMany({ where: { productId, id: { notIn: keep } } });
  for (const [position, v] of rows.entries()) {
    if (v.id && existing.has(v.id)) {
      await tx.productVariant.update({ where: { id: v.id }, data: { measure: v.measure, sku: v.sku, position } });
    } else {
      await tx.productVariant.create({ data: { productId, measure: v.measure, sku: v.sku, position } });
    }
  }

  await tx.compatibility.deleteMany({ where: { productId } });
  if (data.compatibilities.length > 0) {
    await tx.compatibility.createMany({
      data: data.compatibilities.map((c, position) => ({ ...withEngineData(c), productId, position })),
    });
  }
}

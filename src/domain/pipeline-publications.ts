import type { Prisma } from '@/generated/prisma/client';
import type { ProductKind } from '@/generated/prisma/enums';
import { addToPipeline, PipelineError, type Duplicate } from './pipeline';
import { productInputSchema, writeProduct } from './products';
import { insertPublication } from './publications';

// Una publicación nueva que arranca en el pipeline: todavía no está publicada
// en el canal, así que no tiene código. Si el producto no existe, se crea con
// una ficha corta. No sabe nada de canales.

type Tx = Prisma.TransactionClient;

export type ShortProduct = { name: string; productType: string; kind: ProductKind };

const EMPTY_PRODUCT = {
  brand: '',
  partNumber: '',
  engineSystem: '',
  line: '',
  origin: '',
  warranty: '',
  kitContents: '',
  notes: '',
  specs: [],
  variants: [],
  compatibilities: [],
  assets: [],
};

/**
 * Crea la publicación, sin publicar, de un producto que ya está o de uno nuevo
 * con ficha corta, y la agrega al pipeline en Información. Todo junto: si algo
 * falla, no queda nada a medias.
 */
export async function createPipelinePublication(
  tx: Tx,
  args: {
    accountId: string;
    storeId: string;
    productId?: string | null;
    newProduct?: ShortProduct | null;
    userId: string | null;
  },
): Promise<{ publicationId: string; productId: string; related: Duplicate[] }> {
  const store = await tx.store.findFirst({ where: { id: args.storeId, accountId: args.accountId }, select: { id: true } });
  if (!store) throw new PipelineError('Elegí una tienda de esta cuenta.');

  let productId: string;
  if (args.productId) {
    const product = await tx.product.findFirst({ where: { id: args.productId, accountId: args.accountId }, select: { id: true } });
    if (!product) throw new PipelineError('El producto ya no existe en esta cuenta. Buscalo de nuevo.');
    productId = product.id;
  } else if (args.newProduct) {
    const parsed = productInputSchema.safeParse({ ...EMPTY_PRODUCT, ...args.newProduct });
    if (!parsed.success) throw new PipelineError(parsed.error.issues[0]?.message ?? 'Revisá los datos del producto.');
    productId = (await writeProduct(tx, { accountId: args.accountId, productId: null, data: parsed.data })).id;
  } else {
    throw new PipelineError('Elegí un producto o cargá uno nuevo.');
  }

  const { id } = await insertPublication(tx, {
    productId,
    storeId: store.id,
    userId: args.userId,
    data: {
      externalId: null,
      url: null,
      title: null,
      description: null,
      attributes: [],
      price: null,
      channelStatus: 'UNPUBLISHED',
    },
  });
  const added = await addToPipeline(tx, { accountId: args.accountId, publicationIds: [id], userId: args.userId });
  return { publicationId: id, productId, related: added.related };
}

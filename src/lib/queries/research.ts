import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { StoreKnowledge } from '@/domain/research';

// Lo que muestran las tarjetas nuevas del paso Información para un producto.
export async function loadResearch(db: PrismaClient, productId: string) {
  const [research, files, insights, knowledge] = await Promise.all([
    db.productResearch.findUnique({ where: { productId }, include: { updatedBy: { select: { name: true } } } }),
    db.productFile.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } }),
    db.buyerInsight.findMany({ where: { productId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    loadKnowledge(db, productId),
  ]);
  return {
    research,
    files,
    // En un combo, lo que sabe la tienda de cada producto que lo forma.
    knowledgeParts: knowledge.parts,
    pains: insights.filter((i) => i.kind === 'PAIN'),
    objections: insights.filter((i) => i.kind === 'OBJECTION'),
  };
}

export type ResearchData = Awaited<ReturnType<typeof loadResearch>>;

/**
 * Lo que sabe la tienda del producto y, si es un combo, lo de cada producto
 * que lo forma, en orden. Los productos sin nada cargado no aparecen.
 */
export async function loadKnowledge(db: PrismaClient | Prisma.TransactionClient, productId: string): Promise<StoreKnowledge> {
  const p = await db.product.findUnique({
    where: { id: productId },
    select: {
      kind: true,
      research: { select: { storeKnowledge: true } },
      comboItems: { orderBy: { position: 'asc' }, select: { product: { select: { id: true, name: true, research: { select: { storeKnowledge: true } } } } } },
    },
  });
  if (!p) return { own: null, parts: [] };
  const parts = p.kind === 'COMBO' ? p.comboItems.map((i) => i.product) : [];
  return {
    own: p.research?.storeKnowledge ?? null,
    parts: parts.flatMap((x) => (x.research?.storeKnowledge ? [{ productId: x.id, name: x.name, html: x.research.storeKnowledge }] : [])),
  };
}

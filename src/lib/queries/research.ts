import type { PrismaClient } from '@/generated/prisma/client';

// Lo que muestran las tarjetas nuevas del paso Información para un producto.
export async function loadResearch(db: PrismaClient, productId: string) {
  const [research, files, insights] = await Promise.all([
    db.productResearch.findUnique({ where: { productId }, include: { updatedBy: { select: { name: true } } } }),
    db.productFile.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } }),
    db.buyerInsight.findMany({ where: { productId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  return {
    research,
    files,
    pains: insights.filter((i) => i.kind === 'PAIN'),
    objections: insights.filter((i) => i.kind === 'OBJECTION'),
  };
}

export type ResearchData = Awaited<ReturnType<typeof loadResearch>>;

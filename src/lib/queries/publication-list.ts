import { prisma } from '@/lib/db';
import { PRODUCT_CONTENT_SELECT, toContentSnapshot } from '@/domain/content';
import type { ContentSheetRow } from '@/importers/content-sheet';

// Los filtros y el orden del Catálogo viven en catalog-filters.ts.
export * from './catalog-filters';

/** El contenido de esas publicaciones, en el mismo orden, para la planilla. */
export async function listContentSheetRows(publicationIds: string[]): Promise<ContentSheetRow[]> {
  const publications = await prisma.publication.findMany({
    where: { id: { in: publicationIds } },
    select: {
      id: true,
      externalId: true,
      url: true,
      title: true,
      description: true,
      product: { select: PRODUCT_CONTENT_SELECT },
    },
  });
  const byId = new Map(publications.map((p) => [p.id, p]));
  return publicationIds.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    return [{ externalId: p.externalId, url: p.url, content: toContentSnapshot(p.product, p) }];
  });
}

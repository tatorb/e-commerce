import type { PrismaClient } from '@/generated/prisma/client';
import { loadLog } from './measure';
import { adoptExisting } from './mode';
import { productOfPublication } from './product';
import { loadProductGrid, type ProductGrid } from './view';

// Lo que muestra el panel de promociones de un producto: la grilla y la
// bitácora de sus publicaciones. Lo usan la página del producto en
// Promociones, el paso del Pipeline y la página de la publicación.

export type PromoPanelData = { grid: ProductGrid; log: { id: string; at: Date; code: string | null; text: string; auto: boolean; kind: string }[] };

export async function loadPromoPanel(db: PrismaClient, accountId: string, productId: string): Promise<PromoPanelData | null> {
  // En Manual, el almanaque nace con lo que el canal ya muestra inscripto: se suma antes de mostrarlo. No toca el canal.
  await adoptExisting(db, { accountId, productId }).catch((e) => console.error('Promociones: no se pudo sumar lo ya inscripto.', e instanceof Error ? e.message : e));
  const grid = await loadProductGrid(db, accountId, productId);
  if (!grid) return null;
  const ids = grid.measures.flatMap((m) => m.options.map((o) => o.publicationId));
  const rows = await loadLog(db, { accountId, publicationIds: ids, limit: 60 });
  return { grid, log: rows.map((l) => ({ id: l.id, at: l.createdAt, code: l.publication.externalId, text: l.text, auto: l.auto, kind: l.kind })) };
}

/** Lo mismo, desde una publicación del producto. */
export async function loadPromoPanelOf(db: PrismaClient, accountId: string, publicationId: string): Promise<PromoPanelData | null> {
  const productId = await productOfPublication(db, accountId, publicationId);
  return productId ? loadPromoPanel(db, accountId, productId) : null;
}

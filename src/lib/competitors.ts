import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { CompetitorScope } from '@/generated/prisma/enums';
import { COMPETITOR_SELECT, mergeCompetitors, ownerWhere, saveCompetitors, storedCompetitor, type CompetitorOwnerKey, type CompetitorsOutput } from '@/domain/competitors';

export { sharedText } from '@/domain/competitors';

// La competencia es de cada publicación, o del producto cuando su tipo la
// comparte (Ajustes, Tipos y marcas). Acá se decide de quién es la lista que
// se ve y se guarda desde una publicación, y se mueve cuando cambia el ajuste
// o el tipo del producto, sin perder nada.

type Db = PrismaClient | Prisma.TransactionClient;

export type CompetitorOwner = {
  scope: CompetitorScope;
  publicationId: string;
  productId: string;
  // Cuántas publicaciones tiene el producto: con la lista del producto, todas la comparten.
  publications: number;
  key: CompetitorOwnerKey;
};

/** Si la competencia de un tipo es de cada publicación o del producto. Sin tipo, o con uno que no está en la lista, es de cada publicación. */
export async function scopeOfType(db: Db, accountId: string, productType: string | null): Promise<CompetitorScope> {
  if (!productType) return 'PUBLICATION';
  const option = await db.productOption.findUnique({ where: { accountId_kind_name: { accountId, kind: 'TYPE', name: productType } }, select: { competitorScope: true } });
  return option?.competitorScope ?? 'PUBLICATION';
}

/** De quién es la lista de competencia que se ve y se guarda desde esa publicación. Null si no existe. */
export async function competitorOwner(db: Db, publicationId: string): Promise<CompetitorOwner | null> {
  const pub = await db.publication.findUnique({
    where: { id: publicationId },
    select: { id: true, product: { select: { id: true, accountId: true, productType: true, _count: { select: { publications: true } } } } },
  });
  if (!pub) return null;
  const scope = await scopeOfType(db, pub.product.accountId, pub.product.productType);
  return {
    scope,
    publicationId: pub.id,
    productId: pub.product.id,
    publications: pub.product._count.publications,
    key: scope === 'PRODUCT' ? { productId: pub.product.id } : { publicationId: pub.id },
  };
}

/** La lista que se ve desde esa publicación, en su orden, con los campos que se piden. */
export async function loadCompetitors<S extends Prisma.CompetitorListingSelect>(db: Db, owner: CompetitorOwner, select: S) {
  return db.competitorListing.findMany({ where: ownerWhere(owner.key), orderBy: { position: 'asc' }, select });
}

/** Guarda la lista desde una publicación: en ella o, si su tipo la comparte, en el producto. */
export async function saveCompetitorsFrom(tx: Prisma.TransactionClient, publicationId: string, rows: CompetitorsOutput, today?: string): Promise<CompetitorOwner> {
  const owner = await competitorOwner(tx, publicationId);
  if (!owner) throw new Error('La publicación no existe.');
  await saveCompetitors(tx, owner.key, rows, today);
  return owner;
}

const stored = (rows: Parameters<typeof storedCompetitor>[0][]) => rows.map(storedCompetitor);

/** Lo que pasa con un producto al mover su competencia, para contarlo antes de hacerlo. */
type ProductMove = { productId: string; competitors: number; repeated: number; publications: number };

async function planProduct(db: Db, productId: string, to: CompetitorScope): Promise<ProductMove & { write: () => Promise<void> }> {
  const pubs = await db.publication.findMany({
    where: { productId },
    orderBy: [{ mainOptionId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    select: { id: true, competitors: { orderBy: { position: 'asc' }, select: COMPETITOR_SELECT } },
  });
  const own = await db.competitorListing.findMany({ where: { productId }, orderBy: { position: 'asc' }, select: COMPETITOR_SELECT });
  if (to === 'PRODUCT') {
    // Se juntan las listas de todas sus publicaciones, y lo que ya tuviera el producto, sin repetidos.
    const lists = [stored(own), ...pubs.map((p) => stored(p.competitors))];
    const total = lists.reduce((n, l) => n + l.length, 0);
    const { rows, repeated } = mergeCompetitors(lists);
    return {
      productId,
      competitors: total,
      repeated,
      publications: pubs.length,
      write: async () => {
        const tx = db as Prisma.TransactionClient;
        await saveCompetitors(tx, { productId }, rows);
        await tx.competitorListing.deleteMany({ where: { publicationId: { in: pubs.map((p) => p.id) } } });
      },
    };
  }
  // La lista del producto se copia a cada publicación, junto a lo que tuviera cada una.
  const product = stored(own);
  return {
    productId,
    competitors: own.length,
    repeated: 0,
    publications: pubs.length,
    write: async () => {
      const tx = db as Prisma.TransactionClient;
      if (own.length === 0) return;
      for (const p of pubs) await saveCompetitors(tx, { publicationId: p.id }, mergeCompetitors([product, stored(p.competitors)]).rows);
      await tx.competitorListing.deleteMany({ where: { productId } });
    },
  };
}

export type ScopeChangePreview = {
  type: string;
  from: CompetitorScope;
  to: CompetitorScope;
  // Los productos del tipo, y los que tienen competencia para mover.
  products: number;
  productsWithCompetitors: number;
  competitors: number;
  // Las que se juntan por estar repetidas (solo al pasar a "Por producto").
  repeated: number;
  // Las publicaciones que reciben la lista (al pasar a "Por publicación").
  publications: number;
};

async function productsOfType(db: Db, accountId: string, type: string) {
  return db.product.findMany({ where: { accountId, productType: type }, select: { id: true }, orderBy: { createdAt: 'asc' } });
}

/** Cuántos productos y competidores se mueven si el tipo pasa a ese ajuste. No cambia nada. */
export async function previewScopeChange(db: Db, accountId: string, type: string, to: CompetitorScope): Promise<ScopeChangePreview> {
  const from = await scopeOfType(db, accountId, type);
  const products = await productsOfType(db, accountId, type);
  const out: ScopeChangePreview = { type, from, to, products: products.length, productsWithCompetitors: 0, competitors: 0, repeated: 0, publications: 0 };
  if (from === to) return out;
  for (const p of products) {
    const plan = await planProduct(db, p.id, to);
    if (plan.competitors === 0) continue;
    out.productsWithCompetitors++;
    out.competitors += plan.competitors;
    out.repeated += plan.repeated;
    out.publications += plan.publications;
  }
  return out;
}

/** Cambia el ajuste del tipo y mueve la competencia de sus productos. Nunca borra una lista sin haberla pasado a su nuevo dueño. */
export async function changeScope(db: PrismaClient, accountId: string, type: string, to: CompetitorScope): Promise<ScopeChangePreview> {
  return db.$transaction(
    async (tx) => {
      const option = await tx.productOption.findUnique({ where: { accountId_kind_name: { accountId, kind: 'TYPE', name: type } }, select: { id: true } });
      if (!option) throw new Error(`«${type}» ya no está en la lista de tipos.`);
      const preview = await previewScopeChange(tx, accountId, type, to);
      if (preview.from === to) return preview;
      for (const p of await productsOfType(tx, accountId, type)) await (await planProduct(tx, p.id, to)).write();
      await tx.productOption.update({ where: { id: option.id }, data: { competitorScope: to } });
      return preview;
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

/**
 * Después de cambiar el tipo de un producto: si su competencia quedó guardada
 * donde el tipo nuevo no la mira, la pasa al lugar que corresponde.
 */
export async function settleProductCompetitors(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { accountId: true, productType: true } });
  if (!product) return;
  const scope = await scopeOfType(tx, product.accountId, product.productType);
  const misplaced =
    scope === 'PRODUCT'
      ? await tx.competitorListing.count({ where: { publication: { productId } } })
      : await tx.competitorListing.count({ where: { productId } });
  if (misplaced > 0) await (await planProduct(tx, productId, scope)).write();
}

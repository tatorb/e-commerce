import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import {
  CatalogError,
  cleanCatalogValues,
  editableFields,
  findCategory,
  mergeCatalogAttributes,
  readCatalogValues,
  resolveCatalog,
  type CatalogField,
} from '@/domain/catalog-data';
import { parseNameValueList } from '@/domain/name-value';

// Los datos de catálogo de una publicación: busca el canal de su tienda y la
// categoría que le toca, y lee o guarda los valores. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;
type CategoryRef = { id: string; name: string };

async function load(db: Db, publicationId: string) {
  const pub = await db.publication.findUnique({
    where: { id: publicationId },
    select: {
      id: true,
      attributes: true,
      channelCategory: true,
      store: { select: { channel: { select: { kind: true, name: true } } } },
      product: { select: { productType: true, brand: true, partNumber: true, origin: true } },
    },
  });
  if (!pub) throw new CatalogError('La publicación no existe.');
  const channel = pub.store.channel;
  return { pub, channelName: channel.name, catalog: getChannelAdapter(channel.kind, channel.name).catalog };
}

const ref = (c: CategoryRef | null): CategoryRef | null => (c ? { id: c.id, name: c.name } : null);

export type CatalogData = {
  channelName: string;
  family: string | null;
  categories: CategoryRef[];
  category: CategoryRef | null;
  /** De dónde salió la categoría: la familia del producto o la elección a mano. */
  source: 'family' | 'manual' | null;
  familyCategory: CategoryRef | null;
  /** Los campos que se cargan, en el orden del formulario del canal. */
  fields: CatalogField[];
  /** Los que salen de la ficha, con su valor. */
  fromProduct: { field: CatalogField; value: string | null }[];
  /** Lo cargado, por código de campo. */
  values: Record<string, string>;
};

/** Lo que muestra la tarjeta de datos de catálogo. Null si el canal no tiene categorías. */
export async function loadCatalogData(db: Db, publicationId: string): Promise<CatalogData | null> {
  const { pub, channelName, catalog } = await load(db, publicationId);
  if (!catalog) return null;
  const family = pub.product.productType?.trim() || null;
  const { category, source, familyCategory } = resolveCatalog(catalog, family, pub.channelCategory);
  const fields = category ? editableFields(category) : [];
  return {
    channelName,
    family,
    categories: catalog.categories,
    category: ref(category),
    source,
    familyCategory: ref(familyCategory),
    fields,
    fromProduct: (category?.fields ?? [])
      .filter((f) => f.fromProduct)
      .map((field) => ({ field, value: pub.product[field.fromProduct!]?.trim() || null })),
    values: readCatalogValues(fields, parseNameValueList(pub.attributes)),
  };
}

/**
 * Guarda datos de catálogo. Con category, primero cambia la categoría (null
 * vuelve a la de la familia). Con expectedCategoryId, no guarda si la
 * categoría cambió mientras tanto. Los campos que no llegan quedan como
 * estaban; un campo vacío se borra.
 */
export async function saveCatalogData(
  db: PrismaClient,
  args: {
    publicationId: string;
    category?: string | null;
    expectedCategoryId?: string;
    values: Record<string, string | string[] | null | undefined>;
  },
) {
  return db.$transaction(async (tx) => {
    // De a un cambio por publicación a la vez, así no se pisan los atributos.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attributes:${args.publicationId}`}))`;
    const { pub, channelName, catalog } = await load(tx, args.publicationId);
    if (!catalog) throw new CatalogError(`${channelName} todavía no tiene datos de catálogo en la app.`);
    const family = pub.product.productType?.trim() || null;

    let chosen = pub.channelCategory;
    if (args.category !== undefined) {
      const wanted = args.category === null ? null : findCategory(catalog, args.category);
      if (args.category !== null && !wanted) {
        const names = catalog.categories.map((c) => `${c.name} (${c.id})`).join(', ');
        throw new CatalogError(`No hay una categoría «${args.category}». Pueden ser: ${names}.`);
      }
      // Si es la misma que la de la familia, no queda fijada: sigue a la familia.
      chosen = wanted && wanted.id !== catalog.categoryForFamily(family) ? wanted.id : null;
      if (chosen !== pub.channelCategory) {
        await tx.publication.update({ where: { id: pub.id }, data: { channelCategory: chosen } });
      }
    }

    const { category, source } = resolveCatalog(catalog, family, chosen);
    if (args.expectedCategoryId && category?.id !== args.expectedCategoryId) {
      throw new CatalogError('La categoría de la publicación cambió. Recargá la página.');
    }
    const attributes = parseNameValueList(pub.attributes);
    if (Object.keys(args.values).length > 0) {
      if (!category) throw new CatalogError('La publicación no tiene categoría: elegí una primero.');
      const merged = mergeCatalogAttributes(attributes, category.fields, cleanCatalogValues(category.fields, args.values));
      await tx.publication.update({ where: { id: pub.id }, data: { attributes: merged } });
      return { category: ref(category), source, values: readCatalogValues(editableFields(category), merged) };
    }
    return { category: ref(category), source, values: category ? readCatalogValues(editableFields(category), attributes) : {} };
  });
}

import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import {
  CatalogError,
  cleanCatalogValues,
  editableFields,
  findCategory,
  mergeCatalogAttributes,
  normalizeText,
  readCatalogValues,
  resolveCatalog,
  type CatalogField,
} from '@/domain/catalog-data';
import { parseNameValueList } from '@/domain/name-value';
import { lockFamily } from '@/domain/family-members';

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
      storeId: true,
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
  /**
   * Los que suelen ser iguales en toda la tienda y la publicación no tiene: el
   * valor de la mayoría de las publicaciones de la tienda, y de cuántas.
   */
  fromStore: Record<string, { value: string; count: number; total: number }>;
};

/**
 * El valor más usado en las publicaciones de la tienda, como las leyó el canal,
 * para cada campo que suele ser igual en toda la tienda.
 */
async function storeValues(db: Db, storeId: string, fields: CatalogField[]): Promise<CatalogData['fromStore']> {
  if (fields.length === 0) return {};
  const rows = await db.$queryRaw<{ name: string; value: string; n: bigint }[]>`
    SELECT a->>'name' AS name, a->>'value' AS value, count(*) AS n
    FROM channel_copies c
    JOIN publications p ON p.id = c."publicationId",
    jsonb_array_elements(CASE WHEN jsonb_typeof(c.attributes) = 'array' THEN c.attributes ELSE '[]'::jsonb END) a
    WHERE p."storeId" = ${storeId} AND coalesce(a->>'value', '') <> ''
    GROUP BY 1, 2`;
  const out: CatalogData['fromStore'] = {};
  for (const f of fields) {
    const mine = rows.filter((r) => normalizeText(r.name) === normalizeText(f.label) && (!f.options || f.options.includes(r.value)));
    if (mine.length === 0) continue;
    const top = mine.reduce((a, b) => (b.n > a.n ? b : a));
    out[f.id] = { value: top.value, count: Number(top.n), total: mine.reduce((sum, r) => sum + Number(r.n), 0) };
  }
  return out;
}

/** Lo que muestra la tarjeta de datos de catálogo. Null si el canal no tiene categorías. */
export async function loadCatalogData(db: Db, publicationId: string): Promise<CatalogData | null> {
  const { pub, channelName, catalog } = await load(db, publicationId);
  if (!catalog) return null;
  const family = pub.product.productType?.trim() || null;
  const { category, source, familyCategory } = resolveCatalog(catalog, family, pub.channelCategory);
  const fields = category ? editableFields(category) : [];
  const values = readCatalogValues(fields, parseNameValueList(pub.attributes));
  const fromStore = await storeValues(db, pub.storeId, fields.filter((f) => f.sameInStore && !values[f.id]));
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
    values,
    fromStore,
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
    // Las demás medidas de la familia llevan los mismos datos de catálogo.
    const members = await lockFamily(tx, args.publicationId);
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
      // La categoría es de toda la familia de medidas.
      if (chosen !== pub.channelCategory) await tx.publication.updateMany({ where: { id: { in: members } }, data: { channelCategory: chosen } });
    }

    const { category, source } = resolveCatalog(catalog, family, chosen);
    if (args.expectedCategoryId && category?.id !== args.expectedCategoryId) {
      throw new CatalogError('La categoría de la publicación cambió. Recargá la página.');
    }
    const attributes = parseNameValueList(pub.attributes);
    if (Object.keys(args.values).length > 0) {
      if (!category) throw new CatalogError('La publicación no tiene categoría: elegí una primero.');
      const values = cleanCatalogValues(category.fields, args.values);
      const merged = mergeCatalogAttributes(attributes, category.fields, values);
      await tx.publication.update({ where: { id: pub.id }, data: { attributes: merged } });
      // En cada medida cambian los mismos campos; lo demás de cada una queda como estaba.
      for (const other of await tx.publication.findMany({ where: { id: { in: members.filter((id) => id !== pub.id) } }, select: { id: true, attributes: true } })) {
        await tx.publication.update({
          where: { id: other.id },
          data: { attributes: mergeCatalogAttributes(parseNameValueList(other.attributes), category.fields, values) },
        });
      }
      return { category: ref(category), source, values: readCatalogValues(editableFields(category), merged) };
    }
    return { category: ref(category), source, values: category ? readCatalogValues(editableFields(category), attributes) : {} };
  });
}

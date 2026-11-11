import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { settleProductCompetitors } from '@/lib/competitors';
import { cleanOptionName, matchOption, notInListMessage, OPTION_LABEL, optionNameProblem, type OptionKind } from '@/domain/product-options';

// Las listas fijas de tipos de producto y marcas de cada cuenta: leerlas,
// validar lo que se guarda en la ficha y cambiarlas desde Ajustes. Recibe la
// base por parámetro para poder probarlo con una base de prueba.

type Db = PrismaClient | Prisma.TransactionClient;

export class OptionError extends Error {}

export type ProductOptions = { types: string[]; brands: string[] };

/** Las dos listas de la cuenta, en orden alfabético. */
export async function loadProductOptions(db: Db, accountId: string): Promise<ProductOptions> {
  const rows = await db.productOption.findMany({ where: { accountId }, select: { kind: true, name: true } });
  const sorted = (kind: OptionKind) =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b, 'es'));
  return { types: sorted('TYPE'), brands: sorted('BRAND') };
}

const listOf = (o: ProductOptions, kind: OptionKind) => (kind === 'TYPE' ? o.types : o.brands);

/**
 * El tipo y la marca como se guardan: el nombre de la lista que corresponde a
 * lo escrito, sin importar mayúsculas ni acentos. Vacío es sin dato. Lo que no
 * está en la lista da OptionError. Lo que no se manda queda sin tocar.
 */
export async function resolveProductOptions<T extends { productType?: string | null; brand?: string | null }>(
  db: Db,
  accountId: string,
  data: T,
  options?: ProductOptions,
  // Lo que ya tenía el producto: si no cambia, queda como está aunque ya no esté en la lista.
  current?: { productType: string | null; brand: string | null } | null,
): Promise<T> {
  if (data.productType === undefined && data.brand === undefined) return data;
  const lists = options ?? (await loadProductOptions(db, accountId));
  const one = async (kind: OptionKind, raw: string | null | undefined): Promise<string | null | undefined> => {
    if (raw === undefined) return undefined;
    if (raw === null || !cleanOptionName(raw)) return null;
    const had = kind === 'TYPE' ? current?.productType : current?.brand;
    if (had && cleanOptionName(had) === cleanOptionName(raw)) return had;
    const list = listOf(lists, kind);
    const found = matchOption(list, raw);
    if (found) return found;
    // Una cuenta nueva, sin lista todavía: lo primero que se carga la arma.
    if (list.length === 0) return startList(db, accountId, kind, raw, list);
    throw new OptionError(notInListMessage(kind, raw, list));
  };
  return { ...data, productType: await one('TYPE', data.productType), brand: await one('BRAND', data.brand) };
}

/** Suma la primera opción de una lista vacía. */
async function startList(db: Db, accountId: string, kind: OptionKind, raw: string, list: string[]): Promise<string> {
  const name = cleanOptionName(raw);
  await db.productOption.upsert({ where: { accountId_kind_name: { accountId, kind, name } }, create: { accountId, kind, name }, update: {} });
  list.push(name);
  return name;
}

/**
 * Como resolveProductOptions, pero lo que no está en la lista queda sin dato y
 * se avisa. Para el importador. Con open, la lista de ese tipo empezó vacía en
 * esta importación: lo que trae se suma, así la primera importación de una
 * cuenta nueva arma sus listas.
 */
export async function resolveOrDrop(
  db: Db,
  accountId: string,
  lists: ProductOptions,
  kind: OptionKind,
  raw: string | null | undefined,
  open: boolean,
): Promise<{ value: string | null | undefined; warning: string | null }> {
  if (raw === undefined) return { value: undefined, warning: null };
  if (raw === null || !cleanOptionName(raw)) return { value: null, warning: null };
  const list = listOf(lists, kind);
  const found = matchOption(list, raw);
  if (found) return { value: found, warning: null };
  if (open) return { value: await startList(db, accountId, kind, raw, list), warning: null };
  return { value: undefined, warning: `${OPTION_LABEL[kind].field} «${cleanOptionName(raw)}»: no está en la lista, no se cargó.` };
}

/** Cuántos productos usan cada opción. */
export async function optionUsage(db: Db, accountId: string): Promise<{ types: Map<string, number>; brands: Map<string, number> }> {
  const [types, brands] = await Promise.all([
    db.product.groupBy({ by: ['productType'], where: { accountId, productType: { not: null } }, _count: { _all: true } }),
    db.product.groupBy({ by: ['brand'], where: { accountId, brand: { not: null } }, _count: { _all: true } }),
  ]);
  return {
    types: new Map(types.map((t) => [t.productType!, t._count._all])),
    brands: new Map(brands.map((b) => [b.brand!, b._count._all])),
  };
}

export async function addOption(db: PrismaClient, accountId: string, kind: OptionKind, name: string): Promise<string> {
  const lists = await loadProductOptions(db, accountId);
  const problem = optionNameProblem(kind, name, listOf(lists, kind));
  if (problem) throw new OptionError(problem);
  const clean = cleanOptionName(name);
  await db.productOption.create({ data: { accountId, kind, name: clean } });
  return clean;
}

/** La estructura de título de un tipo, guardada por su nombre. */
type Structure = { family?: unknown; structure?: unknown };

/**
 * Cambia el nombre de una opción, y con él el de todos los productos que la
 * usan y, si es un tipo, el de sus estructuras de título. Devuelve cuántos
 * productos cambiaron.
 */
export async function renameOption(db: PrismaClient, accountId: string, kind: OptionKind, from: string, to: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const lists = await loadProductOptions(tx, accountId);
    if (!listOf(lists, kind).includes(from)) throw new OptionError(`«${from}» ya no está en la lista.`);
    const problem = optionNameProblem(kind, to, listOf(lists, kind), from);
    if (problem) throw new OptionError(problem);
    const clean = cleanOptionName(to);
    if (clean === from) return 0;
    await tx.productOption.update({ where: { accountId_kind_name: { accountId, kind, name: from } }, data: { name: clean } });
    const field = kind === 'TYPE' ? 'productType' : 'brand';
    const { count } = await tx.product.updateMany({ where: { accountId, [field]: from }, data: { [field]: clean } });
    if (kind === 'TYPE') {
      // Las reglas de título de ese tipo siguen siendo suyas.
      const sets = await tx.titleRuleSet.findMany({ where: { accountId }, select: { id: true, structures: true } });
      for (const set of sets) {
        const list = Array.isArray(set.structures) ? (set.structures as Structure[]) : [];
        if (!list.some((s) => s.family === from)) continue;
        await tx.titleRuleSet.update({
          where: { id: set.id },
          data: { structures: list.map((s) => (s.family === from ? { ...s, family: clean } : s)) as Prisma.InputJsonValue },
        });
      }
    }
    return count;
  });
}

/** Saca una opción de la lista. Los productos que la tenían quedan sin ese dato. Devuelve cuántos. */
export async function removeOption(db: PrismaClient, accountId: string, kind: OptionKind, name: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const removed = await tx.productOption.deleteMany({ where: { accountId, kind, name } });
    if (removed.count === 0) throw new OptionError(`«${name}» ya no está en la lista.`);
    const field = kind === 'TYPE' ? 'productType' : 'brand';
    const affected = kind === 'TYPE' ? await tx.product.findMany({ where: { accountId, productType: name }, select: { id: true } }) : [];
    const { count } = await tx.product.updateMany({ where: { accountId, [field]: name }, data: { [field]: null } });
    // Sin tipo, la competencia es de cada publicación: la del producto pasa a sus publicaciones.
    for (const p of affected) await settleProductCompetitors(tx, p.id);
    return count;
  });
}

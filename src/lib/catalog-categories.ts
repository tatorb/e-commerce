import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { CatalogError, type CatalogCategory, type CatalogField } from '@/domain/catalog-data';
import { withAccessToken } from '@/lib/connections';

// Cualquier categoría del canal, no solo las de la lista fija: la primera vez
// que se pide se lee de la API de categorías del canal, se revisa que exista y
// que se pueda publicar en ella, y queda guardada en la app. Las guardadas se
// suman al catálogo del canal antes de usarlo. Recibe la base por parámetro
// para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

// Las guardadas se vuelven a leer de la base cada tanto, por si otro servidor sumó una.
const FRESH_MS = 60_000;
const loadedAt = new Map<ChannelKind, number>();

/** Suma al catálogo del canal las categorías guardadas en la app. */
export async function loadSavedCategories(db: Db, kind: ChannelKind): Promise<void> {
  const catalog = getChannelAdapter(kind).catalog;
  if (!catalog?.register) return;
  const at = loadedAt.get(kind);
  if (at && Date.now() - at < FRESH_MS) return;
  const rows = await db.channelCategory.findMany({ where: { kind }, select: { categoryId: true, name: true, path: true, fields: true } });
  for (const r of rows) catalog.register({ id: r.categoryId, name: r.name, path: r.path, fields: (Array.isArray(r.fields) ? r.fields : []) as unknown as CatalogField[] });
  loadedAt.set(kind, Date.now());
}

/** Para las pruebas: que la próxima vez se vuelvan a leer de la base. */
export function forgetSavedCategories(): void {
  loadedAt.clear();
}

/**
 * La categoría con ese código: la de la lista fija o una guardada; si no, la
 * lee del canal con la llave de la tienda, la revisa y la guarda. CatalogError
 * si no existe o si tiene subcategorías.
 */
export async function ensureChannelCategory(db: PrismaClient, args: { storeId: string; kind: ChannelKind; categoryId: string }): Promise<CatalogCategory> {
  const adapter = getChannelAdapter(args.kind);
  const catalog = adapter.catalog;
  if (!catalog) throw new CatalogError(`${adapter.name} todavía no tiene datos de catálogo en la app.`);
  await loadSavedCategories(db, args.kind);
  const code = args.categoryId.trim().toUpperCase();
  const known = catalog.category(code);
  if (known) return known;
  if (!catalog.fetchCategory || !catalog.register) throw new CatalogError(`No hay una categoría «${args.categoryId}».`);
  if (!/^[A-Z]{3}\d{3,}$/.test(code)) throw new CatalogError(`«${args.categoryId}» no es un código de categoría de ${adapter.name}, como MLA458790.`);
  const read = await withAccessToken(db, args.storeId, (token) => catalog.fetchCategory!(code, token));
  if (!read) throw new CatalogError(`${code} no es una categoría de ${adapter.name}: revisá el código.`);
  if (!read.leaf) throw new CatalogError(`${read.name} (${code}) tiene subcategorías: en ${adapter.name} se publica en una de ellas. Elegí la de abajo que corresponda.`);
  const data = { name: read.name, path: read.path, fields: read.fields as unknown as Prisma.InputJsonValue, fetchedAt: new Date() };
  await db.channelCategory.upsert({ where: { kind_categoryId: { kind: args.kind, categoryId: code } }, create: { kind: args.kind, categoryId: code, ...data }, update: data });
  const category = { id: code, name: read.name, path: read.path, fields: read.fields };
  catalog.register(category);
  return category;
}

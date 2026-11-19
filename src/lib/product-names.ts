import type { PrismaClient } from '@/generated/prisma/client';
import type { ActivitySource } from '@/generated/prisma/enums';
import { buildName, NAME_FIELD_LABEL, nameKey, parseNameFormat } from '@/domain/product-names';
import { cleanOptionName, matchTypes, optionKey } from '@/domain/product-options';
import { logActivity } from '@/lib/activity';

// Renombrar productos en tanda con un formato, y el nombre corto de cada tipo
// de producto. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class ProductNameError extends Error {}

export type RenamePlan = {
  // Los que cambian: nombre actual y nuevo.
  toRename: { id: string; from: string; to: string }[];
  // Los que ya tienen el nombre del formato.
  alreadyOk: { id: string; name: string }[];
  // Los que no se pueden renombrar, con el motivo.
  cannot: { id: string; name: string; reason: string }[];
  // Los que quedarían con el mismo nombre que otro producto: no se renombra ninguno.
  conflicts: { id: string; from: string; to: string; with: string[] }[];
  // Con filtro de tipo: los tipos que tomó.
  usedTypes?: string[];
};

export type RenameFilters = { brands?: string[]; types?: string[]; productIds?: string[] };

/** El nombre corto de cada tipo de producto de la cuenta, por el nombre del tipo. */
export async function typeShortNames(db: Db, accountId: string): Promise<Map<string, string>> {
  const rows = await db.productOption.findMany({ where: { accountId, kind: 'TYPE' }, select: { name: true, shortName: true } });
  return new Map(rows.flatMap((r) => (r.shortName ? [[r.name, r.shortName] as [string, string]] : [])));
}

/** Guarda el nombre corto de un tipo de producto. Vacío lo borra. */
export async function setTypeShortName(db: Db, accountId: string, type: string, shortName: string): Promise<void> {
  const types = await db.productOption.findMany({ where: { accountId, kind: 'TYPE' }, select: { id: true, name: true } });
  const found = types.find((t) => optionKey(t.name) === optionKey(type));
  if (!found) throw new ProductNameError(`No existe el tipo de producto «${type}» en la cuenta.`);
  const clean = cleanOptionName(shortName);
  if (clean.length > 100) throw new ProductNameError('El nombre corto puede tener hasta 100 letras.');
  await db.productOption.update({ where: { id: found.id }, data: { shortName: clean || null } });
}

/**
 * Qué nombre le toca a cada producto con el formato. No cambia nada.
 * shortNames: nombres cortos para probar, por tipo, que mandan sobre los guardados.
 */
export async function planRenames(db: Db, args: { accountId: string; format: string; filters?: RenameFilters; shortNames?: Record<string, string> }): Promise<RenamePlan> {
  const parsed = parseNameFormat(args.format);
  if ('error' in parsed) throw new ProductNameError(parsed.error);
  const shorts = await typeShortNames(db, args.accountId);
  const typeNames = Object.keys(args.shortNames ?? {}).length > 0 ? await db.productOption.findMany({ where: { accountId: args.accountId, kind: 'TYPE' }, select: { name: true } }) : [];
  for (const [type, short] of Object.entries(args.shortNames ?? {})) {
    const known = typeNames.find((t) => optionKey(t.name) === optionKey(type));
    if (!known) throw new ProductNameError(`No existe el tipo de producto «${type}» en la cuenta.`);
    if (cleanOptionName(short)) shorts.set(known.name, cleanOptionName(short));
    else shorts.delete(known.name);
  }

  const all = await db.product.findMany({ where: { accountId: args.accountId }, select: { id: true, name: true, productType: true, brand: true, partNumber: true }, orderBy: { name: 'asc' } });
  const f = args.filters ?? {};
  const brands = new Set((f.brands ?? []).map(optionKey).filter(Boolean));
  // Cada tipo pedido: el exacto, sin importar mayúsculas ni acentos, o si no hay, los que lo contienen.
  const allTypes = [...new Set(all.flatMap((p) => (p.productType?.trim() ? [p.productType.trim()] : [])))];
  const usedTypes = matchTypes(allTypes, f.types ?? []);
  const typeSet = new Set(usedTypes);
  const askedTypes = (f.types ?? []).some((t) => optionKey(t));
  const ids = new Set(f.productIds ?? []);
  const wanted = all.filter(
    (p) =>
      (brands.size === 0 || (p.brand !== null && brands.has(optionKey(p.brand)))) &&
      (!askedTypes || (p.productType !== null && typeSet.has(p.productType.trim()))) &&
      (ids.size === 0 || ids.has(p.id)),
  );

  const plan: RenamePlan = { toRename: [], alreadyOk: [], cannot: [], conflicts: [], ...(askedTypes ? { usedTypes } : {}) };
  const candidates: { id: string; from: string; to: string }[] = [];
  for (const p of wanted) {
    const type = p.productType?.trim() || null;
    if (parsed.fields.includes('tipo_corto') && type && !shorts.has(type)) {
      plan.cannot.push({ id: p.id, name: p.name, reason: `El tipo «${type}» no tiene nombre corto: cargalo en Ajustes, Tipos y marcas.` });
      continue;
    }
    const built = buildName(args.format, { tipo: type, tipo_corto: type ? (shorts.get(type) ?? null) : null, marca: p.brand, numero_de_pieza: p.partNumber });
    if ('missing' in built) {
      plan.cannot.push({ id: p.id, name: p.name, reason: `Sin ${built.missing.map((m) => (m === 'tipo_corto' ? 'tipo' : NAME_FIELD_LABEL[m])).join(' ni ')} en la ficha.` });
      continue;
    }
    if (built.name === p.name) plan.alreadyOk.push({ id: p.id, name: p.name });
    else candidates.push({ id: p.id, from: p.name, to: built.name });
  }

  // Los nombres que quedan: los de los productos que no cambian.
  const changing = new Set(candidates.map((c) => c.id));
  const kept = new Map<string, string[]>();
  for (const p of all) if (!changing.has(p.id)) kept.set(nameKey(p.name), [...(kept.get(nameKey(p.name)) ?? []), p.name]);
  const byName = new Map<string, typeof candidates>();
  for (const c of candidates) byName.set(nameKey(c.to), [...(byName.get(nameKey(c.to)) ?? []), c]);
  for (const c of candidates) {
    const same = byName.get(nameKey(c.to))!.filter((o) => o.id !== c.id);
    const taken = kept.get(nameKey(c.to)) ?? [];
    if (same.length > 0 || taken.length > 0) plan.conflicts.push({ ...c, with: [...same.map((o) => o.from), ...taken] });
    else plan.toRename.push(c);
  }
  return plan;
}

/** Renombra lo que el plan dice que cambia, y deja cada cambio en el registro del producto. */
export async function applyRenames(db: Db, args: { accountId: string; plan: RenamePlan; userId: string | null; via?: ActivitySource }): Promise<void> {
  await db.$transaction(args.plan.toRename.map((r) => db.product.update({ where: { id: r.id }, data: { name: r.to } })));
  for (const r of args.plan.toRename) {
    await logActivity(db, {
      userId: args.userId,
      accountId: args.accountId,
      section: 'productos',
      summary: 'Cambió el nombre del producto',
      productId: r.id,
      detail: `Antes: ${r.from} · Ahora: ${r.to}`,
      via: args.via,
    });
  }
}

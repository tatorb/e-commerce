import type { PrismaClient } from '@/generated/prisma/client';
import { brandInput, brandKeyOf, logoType, newBrandKey, parseAliases, type BrandRef } from '@/domain/text-images';

// La base de marcas de vehículos, la misma para todas las cuentas: la usan
// las imágenes con texto para mostrar el logo de cada marca. Cambiarla es
// cosa de un administrador. Recibe la base por parámetro para poder probarla.

type Db = PrismaClient;

export class BrandError extends Error {}

export type BrandRow = BrandRef & { hasLogo: boolean; logoType: string | null; logoUpdatedAt: Date | null };

/** Dónde se ve el logo. Cambia con el logo, para no mostrar uno viejo. */
export const brandLogoHref = (key: string, at: Date | null) => (at ? `/api/marcas-vehiculos/${encodeURIComponent(key)}/logo?v=${at.getTime()}` : null);

export async function listBrands(db: Db): Promise<BrandRow[]> {
  const rows = await db.vehicleBrand.findMany({
    orderBy: { name: 'asc' },
    select: { key: true, name: true, aliases: true, logoType: true, logoUpdatedAt: true },
  });
  return rows.map((r) => ({ ...r, hasLogo: r.logoUpdatedAt !== null }));
}

/** Cuántas imágenes con texto usan cada marca. */
export async function brandUsage(db: Db): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ key: string; n: bigint }[]>`
    SELECT b.key, count(t.id) AS n
    FROM vehicle_brands b
    JOIN text_images t ON t.content->'compatible' @> jsonb_build_array(jsonb_build_object('marca', b.key))
      OR t.content->'no_compatible' @> jsonb_build_array(jsonb_build_object('marca', b.key))
    GROUP BY b.key`;
  return new Map(rows.map((r) => [r.key, Number(r.n)]));
}

function parsed(input: { name: string; aliases: string }) {
  const r = brandInput.safeParse({ name: input.name, aliases: parseAliases(input.aliases ?? '', input.name ?? '') });
  if (!r.success) throw new BrandError(r.error.issues[0]?.message ?? 'Revisá los datos.');
  return r.data;
}

/** Que el nombre ni los alias choquen con otra marca. */
async function checkClash(db: Db, data: { name: string; aliases: string[] }, except: string | null) {
  const others = (await listBrands(db)).filter((b) => b.key !== except);
  for (const value of [data.name, ...data.aliases]) {
    const other = brandKeyOf(value, others);
    if (other) throw new BrandError(`«${value}» ya es de la marca ${others.find((b) => b.key === other)!.name}.`);
  }
}

export async function addBrand(db: Db, input: { name: string; aliases: string }): Promise<string> {
  const data = parsed(input);
  const key = newBrandKey(data.name);
  if (!key) throw new BrandError('Poné un nombre con letras o números.');
  await checkClash(db, data, null);
  if (await db.vehicleBrand.findUnique({ where: { key } })) throw new BrandError(`Ya hay una marca con la clave ${key}.`);
  await db.vehicleBrand.create({ data: { key, name: data.name, aliases: data.aliases } });
  return key;
}

/** Cambia el nombre y los alias. La clave no cambia: es la que usan las piezas. */
export async function updateBrand(db: Db, key: string, input: { name: string; aliases: string }): Promise<void> {
  const data = parsed(input);
  if (!(await db.vehicleBrand.findUnique({ where: { key } }))) throw new BrandError('La marca ya no está.');
  await checkClash(db, data, key);
  await db.vehicleBrand.update({ where: { key }, data: { name: data.name, aliases: data.aliases } });
}

/** Borra una marca que no use ninguna pieza. */
export async function removeBrand(db: Db, key: string): Promise<void> {
  const used = (await brandUsage(db)).get(key) ?? 0;
  if (used > 0) throw new BrandError(`No se puede borrar: la usan ${used === 1 ? '1 imagen con texto' : `${used} imágenes con texto`}.`);
  const r = await db.vehicleBrand.deleteMany({ where: { key } });
  if (r.count === 0) throw new BrandError('La marca ya no está.');
}

/** Si el archivo es de verdad un SVG o un PNG, y no otra cosa con ese nombre. */
function looksLike(type: string, data: Uint8Array): boolean {
  if (type === 'image/png') return data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const head = new TextDecoder().decode(data.slice(0, 2048)).toLowerCase();
  return head.includes('<svg');
}

export async function setBrandLogo(db: Db, args: { key: string; name: string; data: Uint8Array; now?: Date }): Promise<void> {
  const check = logoType({ name: args.name, size: args.data.byteLength });
  if (!check.ok) throw new BrandError(check.error);
  if (!looksLike(check.type, args.data)) throw new BrandError('El archivo no es un SVG o un PNG que se pueda leer.');
  const r = await db.vehicleBrand.updateMany({
    where: { key: args.key },
    data: { logo: Buffer.from(args.data), logoType: check.type, logoUpdatedAt: args.now ?? new Date() },
  });
  if (r.count === 0) throw new BrandError('La marca ya no está.');
}

export async function removeBrandLogo(db: Db, key: string): Promise<void> {
  await db.vehicleBrand.updateMany({ where: { key }, data: { logo: null, logoType: null, logoUpdatedAt: null } });
}

export async function brandLogo(db: Db, key: string): Promise<{ data: Uint8Array; type: string } | null> {
  const b = await db.vehicleBrand.findUnique({ where: { key }, select: { logo: true, logoType: true } });
  return b?.logo && b.logoType ? { data: new Uint8Array(b.logo), type: b.logoType } : null;
}

/** Los logos de esas marcas como data:, para el PNG, con su nombre. */
export async function brandsForPiece(db: Db, keys: string[]): Promise<Record<string, { nombre: string; logo: string | null }>> {
  if (keys.length === 0) return {};
  const rows = await db.vehicleBrand.findMany({ where: { key: { in: keys } }, select: { key: true, name: true, logo: true, logoType: true } });
  return Object.fromEntries(
    rows.map((b) => [b.key, { nombre: b.name, logo: b.logo && b.logoType ? `data:${b.logoType};base64,${Buffer.from(b.logo).toString('base64')}` : null }]),
  );
}

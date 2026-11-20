import type { PrismaClient } from '@/generated/prisma/client';
import { quantityText, type QuantityLine } from '@/domain/quantities';
import { MAX_UNITS_PER_SALE, StockError } from '@/domain/stock';
import { titleOrUntitled } from '@/domain/publication-title';
import { planLabel } from '@/domain/pricing';
import { PLAN_SELECT, planFor, productStockUnits } from '@/lib/stock-plan';
import { syncStock, type SyncResult } from '@/lib/stock';

// Las unidades por venta: de a cuántas unidades del stock del producto vende
// una publicación. El stock y el costo quedan siempre en la unidad en que se
// cargan (una boca de aros, un pistón); lo que cambia es que la publicación
// vende un juego de 4 o una caja de 6. Es de la familia y de todas sus
// opciones de venta; una medida puede tener otro valor. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

export type UnitsRow = {
  id: string;
  externalId: string | null;
  title: string;
  // La medida que vende, si es una sola de un producto con varias.
  measure: string | null;
  // La forma de cobro, si es una opción de venta leída del canal.
  plan: string | null;
  before: number;
  after: number;
  // El stock del producto para lo que vende, en su unidad. Null si la app no lo lleva.
  stock: number | null;
  // La cantidad que tiene hoy en el canal y la que le toca con el valor nuevo. Null si no sale del stock.
  inChannel: string | null;
  planned: string | null;
  // Por qué la cantidad no sale del stock, si no sale.
  note: string | null;
};

const SELECT = { ...PLAN_SELECT, familyId: true, mainOptionId: true, channelCopy: { select: { ...PLAN_SELECT.channelCopy.select, installments: true } } } as const;

/** Las publicaciones que llevan el valor: la medida con sus opciones de venta o, sin soloEstaMedida, toda su familia. */
async function scopeOf(db: Db, accountId: string, publicationId: string, onlyThisMeasure: boolean): Promise<string[]> {
  const p = await db.publication.findFirst({ where: { id: publicationId, product: { accountId } }, select: { id: true, familyId: true, mainOptionId: true } });
  if (!p) throw new StockError('La publicación no está en la cuenta.');
  const mainId = p.mainOptionId ?? p.id;
  const main = mainId === p.id ? p : await db.publication.findUnique({ where: { id: mainId }, select: { id: true, familyId: true } });
  const familyId = main?.familyId ?? p.familyId;
  const heads = !onlyThisMeasure && familyId ? (await db.publication.findMany({ where: { familyId, mainOptionId: null }, select: { id: true } })).map((m) => m.id) : [mainId];
  const all = new Set([...heads, mainId]);
  for (const o of await db.publication.findMany({ where: { mainOptionId: { in: [...all] } }, select: { id: true } })) all.add(o.id);
  if (!onlyThisMeasure && familyId) for (const m of await db.publication.findMany({ where: { familyId }, select: { id: true } })) all.add(m.id);
  return [...all];
}

export function parseUnitsPerSale(raw: unknown): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_UNITS_PER_SALE) {
    throw new StockError(`Las unidades por venta tienen que ser un número entero de 1 a ${MAX_UNITS_PER_SALE.toLocaleString('es-AR')}.`);
  }
  return n;
}

const text = (lines: QuantityLine[] | null) => (lines === null ? null : quantityText(lines));

/** Cómo quedaría cada publicación con ese valor: su cantidad en el canal hoy y la que le tocaría. No guarda nada. */
export async function previewUnitsPerSale(
  db: Db,
  args: { accountId: string; publicationId: string; units: unknown; onlyThisMeasure?: boolean },
): Promise<{ units: number; rows: UnitsRow[] }> {
  const units = parseUnitsPerSale(args.units);
  const ids = await scopeOf(db, args.accountId, args.publicationId, args.onlyThisMeasure === true);
  const rows = await db.publication.findMany({ where: { id: { in: ids } }, orderBy: [{ variantKey: 'asc' }, { createdAt: 'asc' }], select: SELECT });
  return {
    units,
    rows: rows.map((r) => {
      const plan = planFor({ ...r, unitsPerSale: units });
      const installments = r.channelCopy?.installments ?? null;
      return {
        id: r.id,
        externalId: r.externalId,
        title: titleOrUntitled(r.title),
        measure: plan.managed ? (plan.measure?.label ?? null) : null,
        plan: installments === null ? null : planLabel(installments),
        before: r.unitsPerSale,
        after: units,
        stock: productStockUnits(r),
        inChannel: plan.managed ? text(plan.channel) : null,
        planned: plan.managed ? text(plan.real ?? plan.lines) : null,
        note: plan.managed ? null : plan.reason,
      };
    }),
  };
}

/** Guarda las unidades por venta en la medida con sus opciones (o en toda la familia) y sube la cantidad nueva. */
export async function setUnitsPerSale(
  db: Db,
  args: { accountId: string; publicationId: string; units: unknown; onlyThisMeasure?: boolean; userId: string | null },
): Promise<{ units: number; rows: UnitsRow[]; changed: number; sync: SyncResult }> {
  const preview = await previewUnitsPerSale(db, args);
  const ids = preview.rows.map((r) => r.id);
  const r = await db.publication.updateMany({ where: { id: { in: ids }, unitsPerSale: { not: preview.units } }, data: { unitsPerSale: preview.units } });
  const sync = await syncStock(db, { publicationIds: ids, userId: args.userId, note: `Pasó a vender de a ${preview.units}.` });
  return { ...preview, changed: r.count, sync };
}

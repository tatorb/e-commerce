import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { measureHundredths } from '@/domain/insur';
import { measureText, variantKey, type VariantLike } from '@/domain/media';
import { productKey } from '@/domain/product-duplicates';
import { parseNameValueList } from '@/domain/name-value';
import { titleOrUntitled } from '@/domain/publication-title';
import { stockSlots } from '@/domain/stock';

// Los productos duplicados: dos productos de la misma marca y el mismo número
// de pieza. No puede haber dos de lo mismo. Acá se listan y se unen: las
// publicaciones del que se va pasan al que queda, con todo su historial, se
// suma lo que no choca y el que se va se borra. Recibe la base por parámetro
// para poder probarlo.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class MergeError extends Error {}

const LIVE = ['ACTIVE', 'PAUSED'] as const;
const isLive = (status: string) => (LIVE as readonly string[]).includes(status);

const SELECT = {
  id: true,
  name: true,
  kind: true,
  brand: true,
  partNumber: true,
  productType: true,
  engineSystem: true,
  line: true,
  origin: true,
  warranty: true,
  kitContents: true,
  notes: true,
  specs: true,
  replacementCost: true,
  stockSince: true,
  variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } },
  stock: { select: { key: true, quantity: true } },
  branchStock: { select: { quantity: true } },
  costs: { select: { key: true, cost: true } },
  compatibilities: { orderBy: { position: 'asc' } },
  assets: { orderBy: { position: 'asc' } },
  research: true,
  videoScript: { select: { id: true } },
  insurLinks: { select: { code: true, status: true } },
  inCombos: { select: { id: true, comboId: true, quantity: true, combo: { select: { name: true } } } },
  publications: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true, externalId: true, channelStatus: true, variantKey: true } },
  _count: { select: { stockMoves: true, files: true, insights: true, photoEdits: true, videos: true, competitors: true } },
} as const;

type Row = Prisma.ProductGetPayload<{ select: typeof SELECT }>;

async function loadProduct(db: Db | Tx, accountId: string, id: string): Promise<Row | null> {
  return db.product.findFirst({ where: { id, accountId }, select: SELECT });
}

const stockTotal = (p: Row) => p.stock.reduce((s, x) => s + x.quantity, 0);
const hasStock = (p: Row) => p.stock.some((s) => s.quantity !== 0) || p.branchStock.some((s) => s.quantity !== 0);
const crossed = (p: Row) => p.insurLinks.filter((l) => l.status === 'AUTO' || l.status === 'CONFIRMED' || l.status === 'PENDING');

// ───────────────────────────── La lista de duplicados ─────────────────────────────

export type DuplicateProduct = {
  id: string;
  name: string;
  brand: string | null;
  partNumber: string | null;
  // Null: la app todavía no lleva su stock.
  stock: number | null;
  insur: string[];
  publications: { id: string; externalId: string | null; title: string; status: string; live: boolean }[];
};
export type DuplicateGroup = { brand: string | null; partNumber: string; products: DuplicateProduct[]; suggestedId: string | null; why: string };

/**
 * Los productos de la cuenta con la misma marca y el mismo número de pieza, sin
 * importar mayúsculas, espacios ni guiones. De cada grupo sugiere cuál queda:
 * el que tiene publicaciones activas, stock o cruce con Insur.
 */
export async function listDuplicateProducts(db: Db, accountId: string): Promise<DuplicateGroup[]> {
  const rows = await db.product.findMany({
    where: { accountId, partNumber: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      brand: true,
      partNumber: true,
      stockSince: true,
      stock: { select: { quantity: true } },
      insurLinks: { where: { status: { in: ['AUTO', 'CONFIRMED', 'PENDING'] } }, select: { code: true } },
      publications: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true, externalId: true, channelStatus: true } },
    },
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = productKey(r.brand, r.partNumber);
    if (key) groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: DuplicateGroup[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const products: DuplicateProduct[] = list.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      partNumber: p.partNumber,
      stock: p.stockSince ? p.stock.reduce((s, x) => s + x.quantity, 0) : null,
      insur: p.insurLinks.map((l) => l.code),
      publications: p.publications.map((x) => ({ id: x.id, externalId: x.externalId, title: titleOrUntitled(x.title), status: CHANNEL_STATUS_LABEL[x.channelStatus], live: isLive(x.channelStatus) })),
    }));
    // Lo que más pesa: publicaciones activas o pausadas, después el cruce con Insur, después el stock.
    const score = (p: DuplicateProduct) => p.publications.filter((x) => x.live).length * 100 + (p.insur.length > 0 ? 50 : 0) + ((p.stock ?? 0) > 0 ? 10 : 0) + Math.min(p.publications.length, 9);
    const ranked = [...products].sort((a, b) => score(b) - score(a));
    const clear = score(ranked[0]) > score(ranked[1]);
    const reasons = [ranked[0].publications.some((x) => x.live) ? 'tiene publicaciones activas o pausadas' : null, ranked[0].insur.length > 0 ? 'está cruzado con Insur' : null, (ranked[0].stock ?? 0) > 0 ? 'tiene stock' : null].filter(Boolean);
    out.push({
      brand: list[0].brand,
      partNumber: list[0].partNumber!,
      products,
      suggestedId: clear ? ranked[0].id : null,
      why: clear ? `Queda «${ranked[0].name}»: ${reasons.length > 0 ? reasons.join(', ') : 'tiene más publicaciones'}.` : 'No se puede sugerir cuál queda: están parejos. Decidilo con la persona.',
    });
  }
  return out.sort((a, b) => a.partNumber.localeCompare(b.partNumber));
}

// ───────────────────────────── Unir dos productos ─────────────────────────────

/** La medida del que queda que corresponde a una del que se va. undefined: no se puede saber. */
function mapMeasure(key: string | null, from: VariantLike[], to: VariantLike[]): string | null | undefined {
  if (key === null) return null;
  const source = from.find((v) => variantKey(v) === key);
  if (!source) return undefined;
  if (to.some((v) => variantKey(v) === key)) return key;
  const hundredths = measureHundredths(source.measure);
  const text = measureText(source.measure);
  const same = to.filter((v) => (hundredths !== null && measureHundredths(v.measure) === hundredths) || (text !== null && measureText(v.measure) === text));
  return same.length === 1 ? variantKey(same[0]) : undefined;
}

const text = (v: string | null | undefined) => (v ?? '').trim();
const compatibilityKey = (c: Row['compatibilities'][number]) =>
  [c.vehicleBrand, c.model, c.engine, c.displacement, c.fuel, c.power, c.excludedVersions, c.yearFrom, c.yearTo].map((x) => String(x ?? '').trim().toLowerCase()).join('|');

const FIELDS = [
  ['productType', 'el tipo de producto'],
  ['engineSystem', 'el sistema del motor'],
  ['line', 'la línea'],
  ['origin', 'el origen'],
  ['warranty', 'la garantía'],
  ['kitContents', 'el contenido del kit'],
  ['notes', 'las notas'],
] as const;
const RESEARCH = [
  ['manufacturerSite', 'el sitio del fabricante'],
  ['manufacturerProductUrl', 'el link del fabricante'],
  ['manufacturerText', 'lo del fabricante'],
  ['clarifications', 'las aclaraciones'],
  ['storeKnowledge', 'lo que sabe la tienda'],
  ['competitorQuestions', 'las preguntas de la competencia'],
] as const;

export type MergePlan = {
  keep: { id: string; name: string };
  goes: { id: string; name: string };
  // Por qué no se puede unir. Vacío: se puede.
  blockers: string[];
  publications: { id: string; externalId: string | null; title: string; status: string; measure: string | null; note: string | null }[];
  // Lo que se suma al que queda.
  adds: string[];
  // Donde los dos tienen un dato distinto: gana el que queda.
  conflicts: string[];
  // Lo que se pierde al borrar el que se va.
  lost: string[];
  combos: string[];
  done: boolean;
};

async function planOf(db: Db | Tx, accountId: string, keepId: string, goesId: string) {
  if (keepId === goesId) throw new MergeError('Son el mismo producto.');
  const [keep, goes] = await Promise.all([loadProduct(db, accountId, keepId), loadProduct(db, accountId, goesId)]);
  if (!keep) throw new MergeError('El producto que queda no está en la cuenta.');
  if (!goes) throw new MergeError('El producto que se va no está en la cuenta.');
  const blockers: string[] = [];
  if (keep.kind === 'COMBO' || goes.kind === 'COMBO') blockers.push('Uno de los dos es un combo: los combos no se unen.');
  if (hasStock(goes)) blockers.push(`«${goes.name}» tiene stock cargado (${stockTotal(goes)} en total). Pasalo a 0 o cargalo en el que queda antes de unir.`);
  const links = crossed(goes);
  if (links.length > 0) blockers.push(`«${goes.name}» está cruzado con el sistema de Insur (${links.map((l) => l.code).join(', ')}). Ignorá o cambiá ese cruce antes de unir.`);

  const keepSlots = stockSlots(keep.variants);
  const label = (key: string | null) => (key === null ? null : (keep.variants.map((v) => ({ key: variantKey(v), label: v.measure ?? v.sku })).find((x) => x.key === key)?.label ?? null));
  const keyOf = new Map<string, string | null>();
  const publications = goes.publications.map((p) => {
    const mapped = mapMeasure(p.variantKey, goes.variants, keep.variants);
    const live = isLive(p.channelStatus);
    let note: string | null = null;
    let key = mapped ?? null;
    if (mapped === undefined) {
      note = 'No se puede saber a qué medida del que queda corresponde: queda sin medida.';
      if (live) blockers.push(`La publicación ${p.externalId ?? p.id} está ${CHANNEL_STATUS_LABEL[p.channelStatus].toLowerCase()} y su medida no está en «${keep.name}»: no se puede pasar.`);
    } else if (mapped === null && keepSlots.length > 1) {
      note = `No tiene medida y «${keep.name}» tiene ${keepSlots.length}: queda sin medida.`;
      if (live) blockers.push(`La publicación ${p.externalId ?? p.id} está ${CHANNEL_STATUS_LABEL[p.channelStatus].toLowerCase()} y no dice qué medida vende de «${keep.name}»: asignale la medida antes de unir.`);
      key = null;
    }
    keyOf.set(p.id, key);
    return { id: p.id, externalId: p.externalId, title: titleOrUntitled(p.title), status: CHANNEL_STATUS_LABEL[p.channelStatus], measure: label(key), note };
  });

  const adds: string[] = [];
  const conflicts: string[] = [];
  const lost: string[] = [];
  const fill: Record<string, string> = {};
  for (const [field, name] of FIELDS) {
    const a = text(keep[field]);
    const b = text(goes[field]);
    if (!b) continue;
    if (!a) {
      fill[field] = b;
      adds.push(`${name}: «${b.slice(0, 80)}»`);
    } else if (a.toLowerCase() !== b.toLowerCase()) conflicts.push(`${name}: queda «${a.slice(0, 80)}», se descarta «${b.slice(0, 80)}»`);
  }
  // La ficha técnica: los datos que el que queda no tiene.
  const keepSpecs = parseNameValueList(keep.specs);
  const newSpecs = parseNameValueList(goes.specs).filter((s) => {
    const mine = keepSpecs.find((k) => k.name.trim().toLowerCase() === s.name.trim().toLowerCase());
    if (mine && mine.value.trim().toLowerCase() !== s.value.trim().toLowerCase()) conflicts.push(`ficha técnica, ${s.name}: queda «${mine.value}», se descarta «${s.value}»`);
    return !mine;
  });
  if (newSpecs.length > 0) adds.push(`${newSpecs.length} ${newSpecs.length === 1 ? 'dato' : 'datos'} de la ficha técnica: ${newSpecs.map((s) => s.name).join(', ')}`);
  const have = new Set(keep.compatibilities.map(compatibilityKey));
  const newCompat = goes.compatibilities.filter((c) => !have.has(compatibilityKey(c)));
  if (newCompat.length > 0) adds.push(`${newCompat.length} ${newCompat.length === 1 ? 'compatibilidad' : 'compatibilidades'}`);
  const urls = new Set(keep.assets.map((a) => a.url));
  const newAssets = goes.assets.filter((a) => !urls.has(a.url));
  if (newAssets.length > 0) adds.push(`${newAssets.length} ${newAssets.length === 1 ? 'foto o archivo' : 'fotos o archivos'} de la ficha`);
  const research: Record<string, string> = {};
  for (const [field, name] of RESEARCH) {
    const a = text(keep.research?.[field]);
    const b = text(goes.research?.[field]);
    if (!b) continue;
    if (!a) {
      research[field] = b;
      adds.push(`de la investigación, ${name}`);
    } else if (a !== b) conflicts.push(`de la investigación, ${name}: queda lo de «${keep.name}»`);
  }
  const c = goes._count;
  for (const [n, one, many] of [
    [c.files, 'archivo de la investigación', 'archivos de la investigación'],
    [c.insights, 'dolor u objeción de compradores', 'dolores y objeciones de compradores'],
    [c.photoEdits, 'foto corregida', 'fotos corregidas'],
    [c.videos, 'video', 'videos'],
    [c.competitors, 'publicación de la competencia', 'publicaciones de la competencia'],
  ] as const) {
    if (n > 0) adds.push(`${n} ${n === 1 ? one : many}`);
  }
  if (goes.videoScript && keep.videoScript) conflicts.push('el guion de video: queda el de «' + keep.name + '»');
  // El costo de cada medida que el que queda no tiene.
  const keepCosts = new Set(keep.costs.map((x) => x.key));
  const costs = goes.costs.filter((x) => keepSlots.some((s) => s.key === x.key) && !keepCosts.has(x.key));
  if (costs.length > 0) adds.push(`el costo de ${costs.length === 1 ? 'una medida' : `${costs.length} medidas`}`);
  if (c.stockMoves > 0) lost.push(`${c.stockMoves} ${c.stockMoves === 1 ? 'movimiento' : 'movimientos'} del historial de stock de «${goes.name}»`);
  const missing = goes.variants.filter((v) => mapMeasure(variantKey(v), goes.variants, keep.variants) === undefined);
  if (missing.length > 0) lost.push(`las medidas de «${goes.name}» que «${keep.name}» no tiene: ${missing.map((v) => v.measure ?? v.sku ?? 'sin nombre').join(', ')}`);
  const combos = goes.inCombos.map((i) => `${i.combo.name}: pasa a usar «${keep.name}»`);

  const plan: MergePlan = { keep: { id: keep.id, name: keep.name }, goes: { id: goes.id, name: goes.name }, blockers, publications, adds, conflicts, lost, combos, done: false };
  return { plan, keep, goes, keyOf, fill, newSpecs, newCompat, newAssets, research, costs };
}

/**
 * Une dos productos: las publicaciones del que se va pasan al que queda, con
 * su historial, notas, preguntas, visitas y ventas; se suma lo que no choca,
 * los combos pasan a usar el que queda y el que se va se borra. Con preview
 * solo devuelve el plan. Si hay algo que lo impide, no cambia nada y lo dice.
 */
export async function mergeProducts(db: Db, args: { accountId: string; keepId: string; goesId: string; preview?: boolean }): Promise<MergePlan> {
  const first = await planOf(db, args.accountId, args.keepId, args.goesId);
  if (args.preview || first.plan.blockers.length > 0) return first.plan;
  return db.$transaction(
    async (tx) => {
      // Otra vez adentro, por si algo cambió mientras tanto.
      const { plan, keep, goes, keyOf, fill, newSpecs, newCompat, newAssets, research, costs } = await planOf(tx, args.accountId, args.keepId, args.goesId);
      if (plan.blockers.length > 0) return plan;
      const where = { productId: goes.id };
      const to = { productId: keep.id };
      const remap = (key: string | null) => mapMeasure(key, goes.variants, keep.variants) ?? null;

      // Las publicaciones, con todo lo suyo: historial, notas, preguntas, visitas.
      for (const p of goes.publications) await tx.publication.update({ where: { id: p.id }, data: { productId: keep.id, variantKey: keyOf.get(p.id) ?? null } });
      await tx.listingFamily.updateMany({ where, data: to });
      // Las ventas guardan el producto de cada línea.
      for (const table of ['sales', 'channel_sales'] as const) {
        await tx.$executeRawUnsafe(
          `UPDATE ${table} SET lines = replace(lines::text, $1, $2)::jsonb WHERE "storeId" IN (SELECT id FROM stores WHERE "accountId" = $3) AND lines::text LIKE '%' || $1 || '%'`,
          goes.id,
          keep.id,
          args.accountId,
        );
      }
      // Los combos pasan a usar el que queda; si ya lo tenían, se suman las cantidades.
      for (const item of goes.inCombos) {
        const mine = await tx.comboItem.findUnique({ where: { comboId_productId: { comboId: item.comboId, productId: keep.id } }, select: { id: true } });
        if (mine) {
          await tx.comboItem.update({ where: { id: mine.id }, data: { quantity: { increment: item.quantity } } });
          await tx.comboItem.delete({ where: { id: item.id } });
        } else await tx.comboItem.update({ where: { id: item.id }, data: to });
      }

      // Lo que no choca.
      const specs = [...parseNameValueList(keep.specs), ...newSpecs];
      await tx.product.update({ where: { id: keep.id }, data: { ...fill, ...(newSpecs.length > 0 ? { specs } : {}) } });
      let position = keep.compatibilities.length;
      for (const c of newCompat) await tx.compatibility.update({ where: { id: c.id }, data: { ...to, position: position++ } });
      position = keep.assets.length;
      for (const a of newAssets) await tx.asset.update({ where: { id: a.id }, data: { ...to, position: position++ } });
      if (Object.keys(research).length > 0) {
        if (keep.research) await tx.productResearch.update({ where: { id: keep.research.id }, data: research });
        else if (goes.research) await tx.productResearch.update({ where: { id: goes.research.id }, data: to });
      }
      await tx.productFile.updateMany({ where, data: to });
      await tx.buyerInsight.updateMany({ where, data: to });
      await tx.importChange.updateMany({ where, data: to });
      await tx.competitorListing.updateMany({ where, data: to });
      await tx.promotionSlot.updateMany({ where, data: to });
      // Las fotos corregidas, los videos y lo registrado: con la medida del que queda.
      const last = (await tx.photoEdit.aggregate({ where: to, _max: { position: true } }))._max.position ?? -1;
      for (const [i, e] of (await tx.photoEdit.findMany({ where, orderBy: { position: 'asc' }, select: { id: true, variantKey: true } })).entries()) {
        await tx.photoEdit.update({ where: { id: e.id }, data: { ...to, position: last + 1 + i, variantKey: remap(e.variantKey) } });
      }
      for (const v of await tx.productVideo.findMany({ where, select: { id: true, variantKey: true } })) await tx.productVideo.update({ where: { id: v.id }, data: { ...to, variantKey: remap(v.variantKey) } });
      for (const s of await tx.shootCheck.findMany({ where, select: { id: true, variantKey: true } })) await tx.shootCheck.update({ where: { id: s.id }, data: { ...to, variantKey: remap(s.variantKey) } });
      if (goes.videoScript && !keep.videoScript) await tx.videoScript.update({ where: { id: goes.videoScript.id }, data: to });
      if (!(await tx.productPromotion.findUnique({ where: { productId: keep.id }, select: { productId: true } }))) await tx.productPromotion.updateMany({ where, data: to });
      if (costs.length > 0) await tx.productCost.createMany({ data: costs.map((x) => ({ productId: keep.id, key: x.key, cost: x.cost })) });
      await tx.activityLog.updateMany({ where, data: to });
      // Un cruce dudoso con Insur que apuntaba al que se va: se vuelve a mirar en la corrida siguiente.
      await tx.insurArticleLink.updateMany({ where, data: { productId: null, candidates: [] } });

      await tx.product.delete({ where: { id: goes.id } });
      return { ...plan, done: true };
    },
    { timeout: 60_000 },
  );
}

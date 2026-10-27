import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { distinctTexts, familyRead, pipelineRank } from '@/domain/families';
import { parseVariantListings, variantKey } from '@/domain/media';
import { PIPELINE_STEP_LABEL, pipelineLabel } from '@/domain/pipeline';
import { measuresOf, soleMeasureOf, type Measure } from '@/lib/media';
import { productCode } from '@/lib/publication-facts';

// Las familias en la app: cuando el canal guarda cada medida como una
// publicación aparte y las agrupa, la app tiene una publicación por medida,
// juntas en su familia (ListingFamily). Acá se arma la vista previa de la
// pantalla Familias, sin cambiar nada: qué familias del canal se juntan, qué
// medidas faltan traer, qué familias que creó la app se separan en una
// publicación por medida y qué hay que decidir. Este módulo no sabe nada de
// canales: compara los códigos que guardó la lectura.

type Db = PrismaClient | Prisma.TransactionClient;

const PLAN_SELECT = {
  id: true,
  storeId: true,
  productId: true,
  externalId: true,
  title: true,
  description: true,
  faq: true,
  answerRules: true,
  price: true,
  familyId: true,
  variantKey: true,
  variantListings: true,
  pipelineStatus: true,
  pipelineStep: true,
  pipelineRemoval: true,
  createdAt: true,
  channelCopy: { select: { details: true, variations: true } },
} satisfies Prisma.PublicationSelect;

type PlanRow = Prisma.PublicationGetPayload<{ select: typeof PLAN_SELECT }>;
type ProductRow = { id: string; name: string; partNumber: string | null; variants: { sku: string | null; measure: string | null }[] };

/** Una medida de una familia en la vista previa. */
export type PlanMember = {
  id: string | null;
  externalId: string | null;
  title: string | null;
  // La medida que vende, o null si todavía no se sabe.
  measure: string | null;
  pipeline: string;
  // La principal: ahí queda el trabajo del pipeline.
  lead: boolean;
};

export type PlannedFamily = {
  key: string;
  // group: medidas del canal que se juntan. split: una familia que creó la app, que se separa.
  kind: 'group' | 'split';
  // new: se arma. join: ya existe y se suman medidas. done: ya está. conflict: no se puede juntar.
  state: 'new' | 'join' | 'done' | 'conflict';
  productId: string | null;
  productName: string;
  code: string | null;
  members: PlanMember[];
  // Los códigos en el canal de las medidas que la app no tiene.
  missing: string[];
  // Cuántas medidas hay que elegir a mano.
  unknownMeasures: number;
  // Lo que pasa al juntar, en palabras.
  notes: string[];
};

export type PlanCounts = {
  // Familias que cambian: las que se arman, se completan o se separan.
  families: number;
  // Publicaciones de la app que quedan en una familia.
  grouped: number;
  missing: number;
  splits: number;
  // Publicaciones nuevas que salen de separar.
  splitNew: number;
  unknown: number;
  // Familias con algo para revisar.
  decisions: number;
  done: number;
  conflicts: number;
};

export type StorePlan = {
  storeId: string;
  storeName: string;
  channelName: string;
  families: PlannedFamily[];
  // Publicaciones de las que el canal dice su producto y todavía no se leyó la familia.
  unread: number;
  counts: PlanCounts;
};

const emptyCounts = (): PlanCounts => ({ families: 0, grouped: 0, missing: 0, splits: 0, splitNew: 0, unknown: 0, decisions: 0, done: 0, conflicts: 0 });

/** El nombre de la familia que comparten las medidas: el del canal, o el título de la publicación. */
function familyTitle(p: PlanRow): string | null {
  const details = p.channelCopy?.details;
  const name = details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>).channelFamilyName : null;
  return typeof name === 'string' && name.trim() ? name : p.title;
}

/** La medida que vende: la elegida, o la de su SKU en el canal. */
function memberMeasure(p: PlanRow, measures: Measure[]): Measure | null {
  if (p.variantKey) return measures.find((m) => m.key === p.variantKey) ?? null;
  return soleMeasureOf(measures, p.channelCopy);
}

/** La principal: la más avanzada en el pipeline; si empatan, la primera medida de la ficha y la más vieja. */
function leadOf<T extends PlanRow>(rows: T[], measures: Measure[]): T {
  const order = (p: PlanRow) => {
    const m = memberMeasure(p, measures);
    const i = m ? measures.findIndex((x) => x.key === m.key) : -1;
    return i < 0 ? measures.length : i;
  };
  return [...rows].sort((a, b) => pipelineRank(b) - pipelineRank(a) || order(a) - order(b) || a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/** Dónde queda la familia en el pipeline: donde está la principal. */
function whereLeadLeaves(lead: PlanRow): string {
  if (lead.pipelineStatus === 'IN_PIPELINE' && lead.pipelineStep) return `la familia queda en el paso ${PIPELINE_STEP_LABEL[lead.pipelineStep]}, donde está la más avanzada`;
  if (lead.pipelineStatus === 'CORRECTED') return 'la familia queda corregida, como la más avanzada';
  if (lead.pipelineStatus === 'DISCARDED') return 'la familia queda descartada, como la más avanzada';
  return 'la familia queda sin tocar';
}

/** Lo que pasa al juntar las medidas, en palabras. */
function notesFor(rows: PlanRow[], lead: PlanRow): string[] {
  const notes: string[] = [];
  if (new Set(rows.map((p) => pipelineLabel(p))).size > 1) notes.push(`Estaban en lugares distintos del pipeline: ${whereLeadLeaves(lead)}.`);
  if (distinctTexts(rows.map(familyTitle)).length > 1) notes.push('Tenían títulos distintos: queda el de la principal y el cambio queda en Por subir.');
  if (distinctTexts(rows.map((p) => p.description)).length > 1) {
    notes.push('Tenían descripciones distintas: queda la de la principal y el cambio queda en Por subir.');
  }
  if (distinctTexts(rows.map((p) => p.faq)).length > 1) notes.push('Tenían preguntas frecuentes distintas: se juntan una debajo de la otra para que las revises.');
  if (distinctTexts(rows.map((p) => p.answerRules)).length > 1) notes.push('Tenían reglas del bot distintas: se juntan una debajo de la otra para que las revises.');
  const prices = new Set(rows.flatMap((p) => (p.price === null ? [] : [Number(p.price)])));
  if (prices.size > 1) notes.push('Tenían precios distintos: cada medida queda con el suyo.');
  return notes;
}

/** La vista previa de una tienda, con sus publicaciones, productos y familias ya leídos. */
export function planStore(
  store: { id: string; name: string; channelName: string },
  rows: PlanRow[],
  products: Map<string, ProductRow>,
  families: { id: string; channelFamilyId: string | null; members: string[] }[],
): StorePlan {
  const families_: PlannedFamily[] = [];
  const counts = emptyCounts();
  const measuresOfProduct = (id: string) => measuresOf(products.get(id)?.variants ?? []);
  const nameOf = (id: string) => products.get(id)?.name ?? 'Producto';
  const codeOf = (id: string) => {
    const p = products.get(id);
    return p ? productCode(p) : null;
  };

  // Las que la app ya tiene: las propias y las medidas de las familias que creó la app.
  const known = new Set(rows.flatMap((p) => [p.externalId, ...parseVariantListings(p.variantListings).map((v) => v.externalId)]).filter((x): x is string => !!x));

  // Las familias que creó la app: una publicación con varios códigos adentro.
  const splitIds = new Set<string>();
  for (const p of rows) {
    const inside = parseVariantListings(p.variantListings);
    if (inside.length < 2) continue;
    splitIds.add(p.id);
    const measures = measuresOfProduct(p.productId);
    const label = (v: { sku: string | null; measure: string | null }) =>
      measures.find((m) => m.key === variantKey(v))?.label ?? v.measure?.trim() ?? v.sku?.trim() ?? null;
    const pipeline = pipelineLabel(p);
    families_.push({
      key: `split:${p.id}`,
      kind: 'split',
      state: 'new',
      productId: p.productId,
      productName: nameOf(p.productId),
      code: codeOf(p.productId),
      members: inside.map((v, i) => ({ id: i === 0 ? p.id : null, externalId: v.externalId, title: p.title, measure: label(v), pipeline, lead: i === 0 })),
      missing: [],
      unknownMeasures: 0,
      notes: [`Hoy es una sola publicación con ${inside.length} códigos: se separa en ${inside.length} publicaciones, una por medida, con lo que ya tiene.`],
    });
    counts.splits++;
    counts.splitNew += inside.length - 1;
  }

  // Las medidas del canal, agrupadas por su familia.
  const byFamily = new Map<string, { rows: PlanRow[]; listingIds: Set<string> }>();
  let unread = 0;
  for (const p of rows) {
    if (splitIds.has(p.id)) continue;
    const details = p.channelCopy?.details;
    const read = familyRead(details);
    if (!read) {
      const product = details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>).channelProductId : null;
      if (typeof product === 'string' && product) unread++;
      continue;
    }
    if (!read.channelFamilyId) continue;
    const group = byFamily.get(read.channelFamilyId) ?? { rows: [], listingIds: new Set<string>() };
    group.rows.push(p);
    for (const id of read.listingIds) group.listingIds.add(id);
    if (p.externalId) group.listingIds.add(p.externalId);
    byFamily.set(read.channelFamilyId, group);
  }

  for (const [channelFamilyId, group] of byFamily) {
    // Una sola publicación sin otras medidas: no es una familia.
    if (group.listingIds.size < 2) continue;
    const missing = [...group.listingIds].filter((id) => !known.has(id)).sort();
    const productIds = [...new Set(group.rows.map((p) => p.productId))];
    const productId = productIds.length === 1 ? productIds[0] : null;
    const measures = productId ? measuresOfProduct(productId) : [];
    const lead = leadOf(group.rows, measures);
    const members: PlanMember[] = group.rows
      .map((p) => ({ p, m: memberMeasure(p, measures) }))
      .sort((a, b) => {
        const ia = a.m ? measures.findIndex((x) => x.key === a.m!.key) : measures.length;
        const ib = b.m ? measures.findIndex((x) => x.key === b.m!.key) : measures.length;
        return ia - ib || (a.p.externalId ?? '').localeCompare(b.p.externalId ?? '');
      })
      .map(({ p, m }) => ({ id: p.id, externalId: p.externalId, title: p.title, measure: m?.label ?? null, pipeline: pipelineLabel(p), lead: p.id === lead.id }));
    const existing = families.find((f) => f.channelFamilyId === channelFamilyId) ?? null;
    const notes: string[] = [];
    let state: PlannedFamily['state'];
    let unknownMeasures = 0;
    if (!productId) {
      state = 'conflict';
      notes.push('En el canal están en la misma familia, pero en la app son de productos distintos: no se juntan. Revisá sus SKU.');
    } else {
      state = existing ? (group.rows.every((p) => existing.members.includes(p.id)) ? 'done' : 'join') : 'new';
      if (measures.length < 2) notes.push('La ficha del producto no tiene sus medidas cargadas: cargalas para saber qué medida vende cada publicación.');
      else unknownMeasures = members.filter((m) => m.measure === null).length;
      if (unknownMeasures > 0) {
        notes.push(
          unknownMeasures === 1
            ? 'De una publicación no se sabe la medida por su SKU: la vas a elegir a mano.'
            : `De ${unknownMeasures} publicaciones no se sabe la medida por su SKU: las vas a elegir a mano.`,
        );
      }
      if (state !== 'done') notes.push(...notesFor(group.rows, lead));
    }
    // Ya agrupada y sin nada que traer: no cambia nada.
    if (state === 'done' && missing.length === 0 && unknownMeasures === 0) {
      counts.done++;
      continue;
    }
    families_.push({
      key: channelFamilyId,
      kind: 'group',
      state,
      productId,
      productName: productId ? nameOf(productId) : nameOf(group.rows[0].productId),
      code: productId ? codeOf(productId) : null,
      members,
      missing,
      unknownMeasures,
      notes,
    });
    if (state === 'conflict') {
      counts.conflicts++;
      continue;
    }
    counts.missing += missing.length;
    counts.unknown += unknownMeasures;
    if (state !== 'done') counts.grouped += group.rows.filter((p) => !existing?.members.includes(p.id)).length;
  }

  for (const f of families_) {
    if (f.state === 'conflict') continue;
    counts.families++;
    if (f.notes.length > (f.kind === 'split' ? 1 : 0)) counts.decisions++;
  }
  families_.sort((a, b) => (a.code ?? a.productName).localeCompare(b.code ?? b.productName) || a.key.localeCompare(b.key));
  return { storeId: store.id, storeName: store.name, channelName: store.channelName, families: families_, unread, counts };
}

/** La vista previa de las familias de cada tienda de la cuenta, sin cambiar nada. */
export async function planFamilies(db: Db, accountId: string): Promise<StorePlan[]> {
  const stores = await db.store.findMany({
    where: { accountId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, channel: { select: { kind: true, name: true } } },
  });
  const [rows, products, families] = await Promise.all([
    db.publication.findMany({
      where: { storeId: { in: stores.map((s) => s.id) }, channelStatus: { not: 'DELETED' } },
      select: PLAN_SELECT,
      orderBy: { createdAt: 'asc' },
    }),
    db.product.findMany({
      where: { accountId },
      select: { id: true, name: true, partNumber: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } },
    }),
    db.listingFamily.findMany({
      where: { storeId: { in: stores.map((s) => s.id) } },
      select: { id: true, storeId: true, channelFamilyId: true, members: { select: { id: true } } },
    }),
  ]);
  const byProduct = new Map(products.map((p) => [p.id, p]));
  return stores
    .map((s) =>
      planStore(
        { id: s.id, name: s.name, channelName: getChannelAdapter(s.channel.kind, s.channel.name).name },
        rows.filter((p) => p.storeId === s.id),
        byProduct,
        families.filter((f) => f.storeId === s.id).map((f) => ({ id: f.id, channelFamilyId: f.channelFamilyId, members: f.members.map((m) => m.id) })),
      ),
    )
    .filter((s) => s.families.length > 0 || s.unread > 0 || s.counts.done > 0);
}

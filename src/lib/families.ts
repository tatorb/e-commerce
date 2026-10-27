import { Prisma, type PrismaClient, type Publication } from '@/generated/prisma/client';
import type { ChannelStatus, PipelineExit } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { fingerprint } from '@/domain/channel-sync';
import { comparableText, distinctTexts, familyRead, pipelineRank } from '@/domain/families';
import { lockFamily } from '@/domain/family-members';
import { parseMedia, parseVariantListings, variantKey, type PhotoRef } from '@/domain/media';
import { PIPELINE_STEP_LABEL, PIPELINE_STEPS, pipelineLabel } from '@/domain/pipeline';
import { measuresOf, soleMeasureOf, soleMeasurePhotos, type Measure } from '@/lib/media';
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
  // Cuántas medidas hay que elegir a mano, y las medidas de la ficha para elegir.
  unknownMeasures: number;
  measureOptions: { key: string; label: string }[];
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
      measureOptions: [],
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
      measureOptions: measures.map((m) => ({ key: m.key, label: m.label })),
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

// ───────────────────────────── La familia de una publicación ─────────────────────────────

/** Una medida de la familia, como la muestran las pantallas. */
export type FamilyMember = {
  id: string;
  externalId: string | null;
  url: string | null;
  title: string | null;
  variantKey: string | null;
  // La medida, como se llama en la ficha. Null si no se sabe.
  measure: string | null;
  channelStatus: ChannelStatus;
  price: number | null;
  ownPrice: boolean;
  lead: boolean;
};

export type FamilyInfo = { id: string; leadId: string | null; members: FamilyMember[] };

/** La familia de una publicación con sus medidas en el orden de la ficha, la principal primero si empatan. Null sin familia. */
export async function familyOf(db: Db, publicationId: string): Promise<FamilyInfo | null> {
  const p = await db.publication.findUnique({
    where: { id: publicationId },
    select: {
      family: {
        select: {
          id: true,
          leadId: true,
          product: { select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
          members: {
            select: { id: true, externalId: true, url: true, title: true, variantKey: true, channelStatus: true, price: true, ownPrice: true },
          },
        },
      },
    },
  });
  if (!p?.family) return null;
  const f = p.family;
  const measures = measuresOf(f.product.variants);
  const index = (key: string | null) => {
    const i = key ? measures.findIndex((m) => m.key === key) : -1;
    return i < 0 ? measures.length : i;
  };
  const members = f.members
    .map((m) => ({
      id: m.id,
      externalId: m.externalId,
      url: m.url,
      title: m.title,
      variantKey: m.variantKey,
      measure: measures.find((x) => x.key === m.variantKey)?.label ?? null,
      channelStatus: m.channelStatus,
      price: m.price === null ? null : Number(m.price),
      ownPrice: m.ownPrice,
      lead: m.id === f.leadId,
    }))
    .sort((a, b) => index(a.variantKey) - index(b.variantKey) || Number(b.lead) - Number(a.lead) || (a.externalId ?? '').localeCompare(b.externalId ?? ''));
  return { id: f.id, leadId: f.leadId, members };
}

/** La principal de la familia de una publicación, o ella misma si no tiene familia. */
export async function familyLeadId(db: Db, publicationId: string): Promise<string> {
  const p = await db.publication.findUnique({ where: { id: publicationId }, select: { family: { select: { leadId: true } } } });
  return p?.family?.leadId ?? publicationId;
}

// ───────────────────────────── Juntar y separar ─────────────────────────────

export class FamilyError extends Error {}

const JOIN_SELECT = {
  id: true,
  productId: true,
  storeId: true,
  externalId: true,
  title: true,
  description: true,
  faq: true,
  answerRules: true,
  autoAnswer: true,
  channelCategory: true,
  titleLockedManual: true,
  price: true,
  ownPrice: true,
  familyId: true,
  variantKey: true,
  variantListings: true,
  pipelineStatus: true,
  pipelineStep: true,
  pipelineRemoval: true,
  createdAt: true,
  channelCopy: { select: { details: true, variations: true, fingerprints: true, agreed: true } },
} satisfies Prisma.PublicationSelect;

type JoinRow = Prisma.PublicationGetPayload<{ select: typeof JOIN_SELECT }>;
type Tx = Prisma.TransactionClient;

const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/** El nombre de la familia en el canal, si lo dio. */
function channelFamilyName(details: unknown): string | null {
  const name = details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>).channelFamilyName : null;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/** Los textos distintos de las medidas, uno debajo del otro, el de la principal primero. Null si no hay ninguno. */
function joinedTexts(values: (string | null)[]): string | null {
  const texts = distinctTexts(values);
  return texts.length > 0 ? texts.join('\n') : null;
}

/** Lleva una medida al lugar del pipeline de la principal, con su historial. */
async function alignPipeline(tx: Tx, member: JoinRow, lead: JoinRow, userId: string | null, at: Date) {
  if (member.pipelineStatus === lead.pipelineStatus && member.pipelineStep === lead.pipelineStep && member.pipelineRemoval === lead.pipelineRemoval) return;
  if (member.pipelineStatus === 'IN_PIPELINE') {
    const exitKind: PipelineExit =
      lead.pipelineStatus === 'CORRECTED'
        ? 'COMPLETED'
        : lead.pipelineStatus === 'IN_PIPELINE' && lead.pipelineStep && member.pipelineStep
          ? PIPELINE_STEPS.indexOf(lead.pipelineStep) >= PIPELINE_STEPS.indexOf(member.pipelineStep)
            ? 'ADVANCED'
            : 'BACK'
          : 'REMOVED';
    await tx.pipelineMovement.updateMany({
      where: { publicationId: member.id, exitedAt: null },
      data: { exitedAt: at, exitKind, removal: exitKind === 'REMOVED' ? lead.pipelineRemoval : null, exitedById: userId },
    });
  }
  if (lead.pipelineStatus === 'IN_PIPELINE' && lead.pipelineStep) {
    await tx.pipelineMovement.create({ data: { publicationId: member.id, step: lead.pipelineStep, enteredAt: at, userId } });
  }
  await tx.publication.update({
    where: { id: member.id },
    data: { pipelineStatus: lead.pipelineStatus, pipelineStep: lead.pipelineStep, pipelineRemoval: lead.pipelineRemoval },
  });
}

/**
 * Junta publicaciones de un producto en su familia, o las suma a la que ya
 * existe con ese código del canal. Lo que es de la familia queda igual en
 * todas, tomado de la principal: el título (el nombre de la familia en el
 * canal, si lo dio), la descripción, la categoría, el candado del título, las
 * preguntas frecuentes y las reglas del bot (si eran distintas, se juntan) y
 * el lugar en el pipeline. Si tenían precios distintos, cada una conserva el
 * suyo. Cada una necesita saber qué medida vende.
 */
export async function joinFamily(
  tx: Tx,
  args: { storeId: string; productId: string; channelFamilyId: string | null; publicationIds: string[]; userId: string | null; now?: Date },
): Promise<{ familyId: string; joined: number }> {
  const at = args.now ?? new Date();
  const existing = args.channelFamilyId
    ? await tx.listingFamily.findUnique({
        where: { storeId_channelFamilyId: { storeId: args.storeId, channelFamilyId: args.channelFamilyId } },
        select: { id: true, leadId: true, productId: true, members: { select: { id: true } } },
      })
    : null;
  if (existing && existing.productId !== args.productId) throw new FamilyError('La familia es de otro producto.');
  const ids = [...new Set([...(existing?.members.map((m) => m.id) ?? []), ...args.publicationIds])].sort();
  await tx.$queryRaw`SELECT id FROM publications WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
  const rows = await tx.publication.findMany({ where: { id: { in: ids } }, select: JOIN_SELECT });
  if (rows.length !== ids.length) throw new FamilyError('Alguna publicación cambió mientras tanto. Recargá la página.');
  if (rows.some((r) => r.storeId !== args.storeId || r.productId !== args.productId)) {
    throw new FamilyError('Las medidas de una familia tienen que ser del mismo producto y de la misma tienda.');
  }
  if (rows.some((r) => r.familyId && r.familyId !== existing?.id)) throw new FamilyError('Alguna publicación ya está en otra familia.');
  if (rows.some((r) => parseVariantListings(r.variantListings).length >= 2)) {
    throw new FamilyError('Alguna publicación junta varios códigos del canal: primero se separa.');
  }
  const product = await tx.product.findUniqueOrThrow({
    where: { id: args.productId },
    select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } },
  });
  const measures = measuresOf(product.variants);
  const measureOf = new Map(rows.map((r) => [r.id, memberMeasure(r, measures)]));
  if ([...measureOf.values()].some((m) => m === null)) throw new FamilyError('Falta elegir qué medida vende alguna publicación.');

  const lead = rows.find((r) => r.id === existing?.leadId) ?? leadOf(rows, measures);
  const name = channelFamilyName(lead.channelCopy?.details) ?? rows.map((r) => channelFamilyName(r.channelCopy?.details)).find(Boolean) ?? null;
  const ordered = [lead, ...rows.filter((r) => r.id !== lead.id)];
  const shared = {
    title: name ?? lead.title,
    description: lead.description,
    faq: joinedTexts(ordered.map((r) => r.faq)),
    answerRules: joinedTexts(ordered.map((r) => r.answerRules)),
    autoAnswer: lead.autoAnswer,
    channelCategory: lead.channelCategory,
    titleLockedManual: lead.titleLockedManual,
  };
  const family = existing ?? (await tx.listingFamily.create({ data: { storeId: args.storeId, productId: args.productId, channelFamilyId: args.channelFamilyId, leadId: lead.id }, select: { id: true } }));
  if (existing && !existing.leadId) await tx.listingFamily.update({ where: { id: existing.id }, data: { leadId: lead.id } });
  const leadPrice = lead.price === null ? null : Number(lead.price);

  for (const r of rows) {
    const price = r.price === null ? null : Number(r.price);
    // Con un precio distinto del de la familia, la medida conserva el suyo.
    const ownPrice = r.id !== lead.id && (r.ownPrice || (price !== null && leadPrice !== null && price !== leadPrice));
    await tx.publication.update({ where: { id: r.id }, data: { ...shared, familyId: family.id, variantKey: measureOf.get(r.id)!.key, ownPrice } });
    // El título en el canal es el nombre de la familia: la cara del canal queda con ese, así no aparece como un cambio.
    const copy = r.channelCopy;
    const own = channelFamilyName(copy?.details);
    if (copy && own && comparableText(own) === comparableText(shared.title)) {
      const print = fingerprint('title', own);
      const prints = (v: unknown) => ({ ...(v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}), title: print });
      await tx.channelCopy.update({ where: { publicationId: r.id }, data: { title: own, fingerprints: prints(copy.fingerprints), agreed: prints(copy.agreed) } });
    }
    if (r.id !== lead.id) await alignPipeline(tx, r, lead, args.userId, at);
  }
  return { familyId: family.id, joined: rows.filter((r) => r.familyId !== family.id).length };
}

/**
 * Una publicación nueva de la familia, con lo mismo que la principal: lo
 * compartido, su lugar en el pipeline y su historial desde ahora. Lleva su
 * medida, su código del canal si ya tiene y sus fotos. Devuelve su id.
 */
async function copyMember(
  tx: Tx,
  head: Publication,
  args: { familyId: string; variantKey: string | null; externalId: string | null; media: PhotoRef[] | null; at: Date; userId: string | null },
): Promise<string> {
  const p = await tx.publication.create({
    data: {
      productId: head.productId,
      storeId: head.storeId,
      externalId: args.externalId,
      title: head.title,
      description: head.description,
      attributes: head.attributes as Prisma.InputJsonValue,
      ownQuestions: null,
      faq: head.faq,
      answerRules: head.answerRules,
      autoAnswer: head.autoAnswer,
      price: head.price,
      installments: head.installments,
      discount: head.discount,
      currency: head.currency,
      channelStatus: args.externalId ? head.channelStatus : 'UNPUBLISHED',
      stage: head.stage,
      pipelineStatus: head.pipelineStatus,
      pipelineStep: head.pipelineStep,
      pipelineRemoval: head.pipelineRemoval,
      titleLockedManual: head.titleLockedManual,
      channelCategory: head.channelCategory,
      media: json(args.media),
      videoVariants: head.videoVariants as Prisma.InputJsonValue,
      followsStock: head.followsStock,
      source: head.source,
      familyId: args.familyId,
      variantKey: args.variantKey,
    },
    select: { id: true },
  });
  await tx.stageMovement.create({ data: { publicationId: p.id, stage: head.stage, enteredAt: args.at, userId: args.userId } });
  if (head.pipelineStatus === 'IN_PIPELINE' && head.pipelineStep) {
    await tx.pipelineMovement.create({ data: { publicationId: p.id, step: head.pipelineStep, enteredAt: args.at, userId: args.userId } });
  }
  return p.id;
}

/**
 * Separa una publicación que la app creó con un código del canal por medida
 * (variantListings) en una publicación por medida, en su familia. La primera
 * queda como principal, con su historial; cada una nueva lleva lo mismo, las
 * fotos de su medida, su lugar en el pipeline y las preguntas que recibió su
 * código. Devuelve las publicaciones nuevas.
 */
export async function splitFamily(tx: Tx, args: { publicationId: string; userId: string | null; now?: Date }): Promise<string[]> {
  const at = args.now ?? new Date();
  await tx.$queryRaw`SELECT id FROM publications WHERE id = ${args.publicationId} FOR UPDATE`;
  const head = await tx.publication.findUniqueOrThrow({
    where: { id: args.publicationId },
    include: { product: { select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } }, channelCopy: { select: { details: true } } },
  });
  const inside = parseVariantListings(head.variantListings);
  if (inside.length < 2) return [];
  if (head.familyId) throw new FamilyError('La publicación ya está en una familia.');
  const measures = measuresOf(head.product.variants);
  const measureOf = (v: { sku: string | null; measure: string | null }) =>
    measures.find((m) => m.key === variantKey(v)) ?? measures.find((m) => m.sku && v.sku && m.sku.toUpperCase() === v.sku.trim().toUpperCase()) ?? null;
  const media = parseMedia(head.media);
  const mediaFor = (m: Measure | null) => (media === null ? null : m ? soleMeasurePhotos(media, measures, m) : media);

  // El código de la familia en el canal, si se leyó y no lo tiene otra.
  const read = familyRead(head.channelCopy?.details)?.channelFamilyId ?? null;
  const taken = read ? await tx.listingFamily.count({ where: { storeId: head.storeId, channelFamilyId: read } }) : 0;
  const family = await tx.listingFamily.create({
    data: { storeId: head.storeId, productId: head.productId, channelFamilyId: taken > 0 ? null : read, leadId: head.id },
    select: { id: true },
  });
  const created: string[] = [];
  for (const [i, v] of inside.entries()) {
    const m = measureOf(v);
    if (i === 0) {
      await tx.publication.update({
        where: { id: head.id },
        data: { familyId: family.id, variantKey: m?.key ?? null, variantListings: [], media: json(mediaFor(m)) },
      });
      continue;
    }
    const id = await copyMember(tx, head, { familyId: family.id, variantKey: m?.key ?? null, externalId: v.externalId, media: mediaFor(m), at, userId: args.userId });
    // Las preguntas que recibió el código de esta medida pasan a su publicación.
    await tx.buyerQuestion.updateMany({ where: { storeId: head.storeId, listingId: v.externalId }, data: { publicationId: id } });
    created.push(id);
  }
  return created;
}

/**
 * Arma la familia de una publicación sin publicar de un producto con varias
 * medidas: una publicación por medida, con lo mismo que la principal y las
 * fotos de su medida. Si ya está en una familia que no tiene nada publicado,
 * suma las medidas de la ficha que le faltan. Las publicadas no se tocan: sus
 * medidas llegan del canal. Devuelve las publicaciones nuevas.
 */
export async function familyByMeasure(tx: Tx, args: { publicationId: string; userId: string | null; now?: Date }): Promise<string[]> {
  const at = args.now ?? new Date();
  const ids = await lockFamily(tx, args.publicationId);
  const rows = await tx.publication.findMany({
    where: { id: { in: ids } },
    include: { family: { select: { leadId: true } }, product: { select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } } },
  });
  if (rows.length === 0 || rows.some((r) => r.externalId || parseVariantListings(r.variantListings).length >= 2)) return [];
  const measures = measuresOf(rows[0].product.variants);
  if (measures.length < 2) return [];
  const head = rows.find((r) => r.id === rows[0].family?.leadId) ?? rows.find((r) => r.id === args.publicationId)!;
  const media = parseMedia(head.media);
  const mediaFor = (m: Measure) => (media === null ? null : soleMeasurePhotos(media, measures, m));

  let familyId = head.familyId;
  if (!familyId) {
    const own = measures.find((m) => m.key === head.variantKey) ?? measures[0];
    familyId = (await tx.listingFamily.create({ data: { storeId: head.storeId, productId: head.productId, leadId: head.id }, select: { id: true } })).id;
    await tx.publication.update({ where: { id: head.id }, data: { familyId, variantKey: own.key, ownPrice: false, media: json(mediaFor(own)) } });
    head.variantKey = own.key;
  }
  const covered = new Set(rows.map((r) => (r.id === head.id ? head.variantKey : r.variantKey)));
  const created: string[] = [];
  for (const m of measures) {
    if (covered.has(m.key)) continue;
    created.push(await copyMember(tx, head, { familyId, variantKey: m.key, externalId: null, media: mediaFor(m), at, userId: args.userId }));
  }
  return created;
}

/**
 * Le pone a una familia el código que le dio el canal, si todavía no lo tiene:
 * el que leyeron sus medidas, si es uno solo y no lo tiene otra familia.
 */
export async function fillFamilyCode(db: Db, familyId: string): Promise<boolean> {
  const family = await db.listingFamily.findUnique({
    where: { id: familyId },
    select: { storeId: true, channelFamilyId: true, members: { select: { channelCopy: { select: { details: true } } } } },
  });
  if (!family || family.channelFamilyId) return false;
  const read = [...new Set(family.members.flatMap((m) => familyRead(m.channelCopy?.details)?.channelFamilyId ?? []))];
  if (read.length !== 1) return false;
  const taken = await db.listingFamily.count({ where: { storeId: family.storeId, channelFamilyId: read[0] } });
  if (taken > 0) return false;
  await db.listingFamily.update({ where: { id: familyId }, data: { channelFamilyId: read[0] } });
  return true;
}

/** Le pone a cada familia de esas publicaciones que no tiene código el que le dio el canal. */
export async function fillFamilyCodes(db: Db, publicationIds: string[]): Promise<number> {
  if (publicationIds.length === 0) return 0;
  const families = await db.listingFamily.findMany({
    where: { channelFamilyId: null, members: { some: { id: { in: publicationIds } } } },
    select: { id: true },
  });
  let filled = 0;
  for (const f of families) if (await fillFamilyCode(db, f.id)) filled++;
  return filled;
}

/**
 * Suma a su familia las publicaciones que llegaron después: las que el canal
 * dice que son de una familia que ya está en la app, del mismo producto y con
 * su medida conocida. Las demás quedan para la pantalla Familias.
 */
export async function joinKnownFamilies(db: PrismaClient, storeId: string, publicationIds: string[]): Promise<number> {
  if (publicationIds.length === 0) return 0;
  const rows = await db.publication.findMany({
    where: { id: { in: publicationIds }, storeId, familyId: null },
    select: {
      id: true,
      productId: true,
      variantKey: true,
      variantListings: true,
      channelCopy: { select: { details: true, variations: true } },
      product: { select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
    },
  });
  let joined = 0;
  for (const r of rows) {
    if (parseVariantListings(r.variantListings).length >= 2) continue;
    const channelFamilyId = familyRead(r.channelCopy?.details)?.channelFamilyId;
    if (!channelFamilyId) continue;
    const family = await db.listingFamily.findUnique({ where: { storeId_channelFamilyId: { storeId, channelFamilyId } }, select: { productId: true } });
    if (!family || family.productId !== r.productId) continue;
    const measures = measuresOf(r.product.variants);
    const known = r.variantKey ? measures.some((m) => m.key === r.variantKey) : soleMeasureOf(measures, r.channelCopy) !== null;
    if (!known) continue;
    try {
      await db.$transaction((tx) => joinFamily(tx, { storeId, productId: r.productId, channelFamilyId, publicationIds: [r.id], userId: null }));
      joined++;
    } catch (e) {
      if (!(e instanceof FamilyError)) throw e;
    }
  }
  return joined;
}

/** Elige a mano qué medida vende una publicación, para las que no se sabe por su SKU. */
export async function setPublicationMeasure(db: PrismaClient, args: { accountId: string; publicationId: string; variantKey: string }): Promise<void> {
  const p = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: { id: true, product: { select: { variants: { select: { sku: true, measure: true } } } } },
  });
  if (!p) throw new FamilyError('La publicación no existe en esta cuenta.');
  if (!measuresOf(p.product.variants).some((m) => m.key === args.variantKey)) throw new FamilyError('Esa medida no está en la ficha del producto.');
  await db.publication.update({ where: { id: p.id }, data: { variantKey: args.variantKey } });
}

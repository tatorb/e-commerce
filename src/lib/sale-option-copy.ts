import { clashText, productChannelCategories } from '@/lib/channel-category';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { getChannelPublisher, PublishError } from '@/channels/publish';
import { isInstallmentPlan, planLabel, INSTALLMENT_PLANS } from '@/domain/pricing';
import { parseWarranty } from '@/domain/warranty';
import { LIVE_OPTION } from '@/domain/sale-options';
import { isTitleLocked } from '@/lib/channel-push';
import { readOne } from '@/lib/channel-sync';
import { withAccessToken } from '@/lib/connections';
import { loadOptionTable } from '@/lib/option-table';

// Igualar las opciones de venta de una medida con la buena y crear las formas
// de cobro que le faltan. La buena es la que está en el pipeline: de ella sale
// todo lo que se copia. Igualar deja los cambios en Por subir; crear sí crea la
// publicación en el canal, copiada de la buena. Sin nada propio de un canal:
// lo de cada canal lo hace su publicador. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export class SaleOptionCopyError extends Error {}

const ROW_SELECT = {
  id: true,
  externalId: true,
  productId: true,
  storeId: true,
  familyId: true,
  variantKey: true,
  mainOptionId: true,
  pipelineStatus: true,
  pipelineStep: true,
  channelStatus: true,
  installments: true,
  title: true,
  description: true,
  attributes: true,
  faq: true,
  answerRules: true,
  autoAnswer: true,
  warranty: true,
  media: true,
  currency: true,
  channelCopy: {
    select: {
      status: true,
      statusBlocked: true,
      installments: true,
      channelProductId: true,
      categoryId: true,
      quantity: true,
      photoIds: true,
      description: true,
      warranty: true,
      details: true,
      variations: true,
    },
  },
} as const;

type Row = Prisma.PublicationGetPayload<{ select: typeof ROW_SELECT }>;

const statusOf = (r: Row): ChannelStatus => r.channelCopy?.status ?? r.channelStatus;
const planOf = (r: Row): number | null => r.channelCopy?.installments ?? r.installments ?? null;
// La que sigue vendiendo: viva y sin frenar por el canal.
const selling = (r: Row) => LIVE_OPTION.includes(statusOf(r)) && !r.channelCopy?.statusBlocked;

export type MeasureGroup = { main: Row; source: Row; options: Row[]; missing: number[] };

/**
 * Las medidas de la publicación: si es de una familia, todas sus medidas; si
 * no, la suya. Cada una con su principal, la buena (la que está en el pipeline,
 * o la pedida) y las formas de cobro que le faltan.
 */
export async function measureGroups(db: Db, args: { accountId: string; publicationId: string; sourceId?: string }): Promise<MeasureGroup[]> {
  const p = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: { id: true, mainOptionId: true, familyId: true },
  });
  if (!p) throw new SaleOptionCopyError('La publicación no está en la cuenta.');
  const mainOf = p.mainOptionId ?? p.id;
  // Las principales de cada medida: las de la familia que no apuntan a otra, o la suya.
  const mainIds = p.familyId
    ? (await db.publication.findMany({ where: { familyId: p.familyId, mainOptionId: null }, select: { id: true } })).map((r) => r.id)
    : [mainOf];
  if (!mainIds.includes(mainOf)) mainIds.push(mainOf);
  const rows = await db.publication.findMany({
    where: { OR: [{ id: { in: mainIds } }, { mainOptionId: { in: mainIds } }] },
    orderBy: { createdAt: 'asc' },
    select: ROW_SELECT,
  });
  return mainIds.map((mainId) => {
    const main = rows.find((r) => r.id === mainId)!;
    const all = rows.filter((r) => r.id === mainId || r.mainOptionId === mainId);
    const source =
      (args.sourceId ? all.find((r) => r.id === args.sourceId) : undefined) ??
      all.find((r) => r.pipelineStatus === 'IN_PIPELINE') ??
      null;
    if (!source) {
      throw new SaleOptionCopyError(
        `Ninguna publicación de la medida de ${main.externalId ?? 'la principal'} está en el pipeline: decí cuál es la buena con desde.`,
      );
    }
    const have = new Set(all.filter(selling).map(planOf).filter((x): x is number => x !== null));
    return { main, source, options: all.filter((r) => r.id !== source.id), missing: INSTALLMENT_PLANS.filter((plan) => !have.has(plan)) };
  });
}

// Lo que se copia de la buena a las otras opciones, con su nombre para mostrar.
const COPIED = {
  title: 'título',
  description: 'descripción',
  attributes: 'datos de catálogo',
  faq: 'preguntas frecuentes',
  answerRules: 'reglas del bot',
  autoAnswer: 'responder solo',
  warranty: 'garantía',
} as const;
type Copied = keyof typeof COPIED;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export type NormalizeTarget = {
  id: string;
  externalId: string | null;
  plan: string;
  changes: string[];
  skipped: string[];
  untouched: string | null;
  photos?: { copied: number; notInTarget: number };
};

export type NormalizeReport = { main: string | null; source: string | null; targets: NormalizeTarget[]; missing: string[] }[];

/**
 * Iguala las otras opciones de cada medida con la buena: título (si no está
 * bloqueado por ventas), descripción, datos de catálogo, preguntas
 * frecuentes, reglas del bot, responder solo, garantía, fotos y clips. Sin
 * apply solo dice qué cambiaría. Con apply lo guarda en la app: queda en Por subir.
 */
export async function normalizeSaleOptions(
  db: Db,
  args: {
    accountId: string;
    publicationId: string;
    sourceId?: string;
    apply: boolean;
    userId: string | null;
    copyMedia?: (fromId: string, toId: string) => Promise<{ fotos?: number; fotos_que_no_estan_en_esta?: number }>;
  },
): Promise<NormalizeReport> {
  const groups = await measureGroups(db, args);
  const report: NormalizeReport = [];
  for (const g of groups) {
    const targets: NormalizeTarget[] = [];
    for (const t of g.options) {
      const plan = planOf(t);
      const entry: NormalizeTarget = { id: t.id, externalId: t.externalId, plan: plan === null ? 'sin leer' : planLabel(plan), changes: [], skipped: [], untouched: null };
      targets.push(entry);
      const status = statusOf(t);
      if (status === 'CLOSED' || status === 'DELETED') {
        entry.untouched = 'Está finalizada: no se toca.';
        continue;
      }
      if (t.channelCopy?.statusBlocked) {
        entry.untouched = 'El canal la frenó: no se toca.';
        continue;
      }
      const data: Prisma.PublicationUpdateInput = {};
      for (const field of Object.keys(COPIED) as Copied[]) {
        const from = g.source[field];
        if (from === null || from === undefined || (typeof from === 'string' && !from.trim())) continue;
        if (same(from, t[field])) continue;
        if (field === 'title' && t.externalId && (await isTitleLocked(db, args.accountId, t.id))) {
          entry.skipped.push('título: está bloqueado por ventas, queda el suyo');
          continue;
        }
        (data as Record<string, unknown>)[field] = field === 'attributes' || field === 'warranty' ? (from as Prisma.InputJsonValue) : from;
        entry.changes.push(COPIED[field]);
      }
      if (!args.apply) continue;
      if (Object.keys(data).length > 0) await db.publication.update({ where: { id: t.id }, data });
      if (args.copyMedia) {
        const m = await args.copyMedia(g.source.id, t.id);
        entry.photos = { copied: m.fotos ?? 0, notInTarget: m.fotos_que_no_estan_en_esta ?? 0 };
      }
    }
    report.push({
      main: g.main.externalId,
      source: g.source.externalId,
      targets,
      missing: g.missing.map((plan) => planLabel(plan)),
    });
  }
  return report;
}

export type CreatedOption = { id: string; externalId: string; url: string | null; plan: string; price: number; joined: boolean; warnings: string[] };

/**
 * Crea en el canal otra forma de cobro para la medida, copiada de la buena:
 * el mismo nombre, la descripción, los datos de catálogo, la garantía y las
 * fotos. El precio, sin decirlo, es el de esa forma de cobro desde el precio
 * sin cuotas guardado. Queda en la app como otra opción de la medida. Si el
 * canal no la juntó con la medida, lo avisa.
 */
export async function createSaleOption(
  db: Db,
  args: { accountId: string; publicationId: string; sourceId?: string; plan: number; price?: number; userId: string | null; now?: Date },
): Promise<CreatedOption> {
  if (!isInstallmentPlan(args.plan)) throw new SaleOptionCopyError('La forma de cobro es sin cuotas, cuota promocionada, 3, 6, 9 o 12 cuotas.');
  const plan = args.plan;
  const p = await db.publication.findFirst({ where: { id: args.publicationId, product: { accountId: args.accountId } }, select: { id: true, mainOptionId: true } });
  if (!p) throw new SaleOptionCopyError('La publicación no está en la cuenta.');
  // Solo la medida de esta publicación, no toda la familia.
  const group = (await measureGroups(db, { ...args, publicationId: p.mainOptionId ?? p.id })).find((g) => g.main.id === (p.mainOptionId ?? p.id))!;
  if (!group.missing.includes(plan)) throw new SaleOptionCopyError(`La medida ya tiene ${planLabel(plan).toLowerCase()} a la venta.`);
  const { main, source } = group;
  if (!source.externalId) throw new SaleOptionCopyError('La buena todavía no está publicada en el canal.');

  const store = await db.store.findUniqueOrThrow({ where: { id: source.storeId }, select: { id: true, channel: { select: { kind: true, name: true } } } });
  const channelName = getChannelAdapter(store.channel.kind, store.channel.name).name;
  const publisher = getChannelPublisher(store.channel.kind);
  if (!publisher?.addOption) throw new SaleOptionCopyError(`Todavía no se pueden crear opciones de venta en ${channelName}.`);

  // El precio de esa forma de cobro, con la misma ganancia que el sin cuotas guardado.
  let price = args.price ? Math.round(args.price) : null;
  if (!price) {
    const table = await loadOptionTable(db, { accountId: args.accountId, publicationId: main.id, campaigns: false });
    const tab = table?.groups.find((g) => g.measures.some((m) => m.mainId === main.id));
    price = tab?.rows.find((r) => r.plan === plan)?.price ?? null;
    if (!price) throw new SaleOptionCopyError('No se pudo calcular el precio: falta el costo o el precio sin cuotas. Pasá el precio.');
  }

  // Lo que es de la opción y no del producto: el precio, la cantidad, la descripción y la garantía.
  // El nombre, la categoría, los datos de catálogo y las fotos son del producto del canal: los toma de ahí.
  const description = source.description?.trim() || source.channelCopy?.description?.trim() || null;
  const warranty = parseWarranty(source.warranty) ?? parseWarranty(source.channelCopy?.warranty);

  // La categoría es la que el canal ya eligió para el producto: la de sus otras opciones activas, en
  // todas sus medidas. El canal finaliza las que quedan en otra. Si ya hay en dos, no se crea otra.
  const product = await db.publication.findUniqueOrThrow({ where: { id: main.id }, select: { productId: true } });
  const inChannel = await productChannelCategories(db, { productId: product.productId, storeId: store.id });
  if (inChannel.length > 1) throw new SaleOptionCopyError(clashText(inChannel, channelName));
  const categoryId = inChannel[0]?.categoryId ?? source.channelCopy?.categoryId ?? main.channelCopy?.categoryId ?? null;
  if (!categoryId) throw new SaleOptionCopyError('Todavía no se leyó la categoría de la buena en el canal: leela de nuevo antes de crear.');

  // La medida en el canal: la nueva se suma a ella. Sin leerla, el canal armaría un producto aparte.
  const channelProductId = main.channelCopy?.channelProductId ?? source.channelCopy?.channelProductId ?? null;
  if (!channelProductId) throw new SaleOptionCopyError('Todavía no se leyó la medida de la buena en el canal: leela de nuevo antes de crear.');

  const warnings: string[] = [];
  const made = await withAccessToken(db, store.id, async (token, sellerId) => {
    let member;
    try {
      member = await publisher.addOption!(token, sellerId, {
        channelProductId,
        categoryId,
        plan,
        price: price!,
        currency: source.currency,
        description,
        warranty,
      });
    } catch (e) {
      if (e instanceof PublishError) throw new SaleOptionCopyError(`${channelName} no la creó: ${e.message}`);
      throw e;
    }
    warnings.push(...member.warnings);
    try {
      await publisher.setInstallments(token, member.externalId, plan);
    } catch (e) {
      if (!(e instanceof PublishError)) throw e;
      warnings.push(`Se creó, pero no tomó ${planLabel(plan).toLowerCase()}: ${e.message} Cambiala en el canal o subí las cuotas desde la app.`);
    }
    return member;
  });

  const row = await db.$transaction(async (tx) => {
    const r = await tx.publication.create({
      data: {
        productId: source.productId,
        storeId: source.storeId,
        externalId: made.externalId,
        url: made.url,
        title: source.title,
        description: source.description,
        attributes: (source.attributes ?? []) as Prisma.InputJsonValue,
        faq: source.faq,
        answerRules: source.answerRules,
        autoAnswer: source.autoAnswer,
        warranty: source.warranty === null ? Prisma.DbNull : (source.warranty as Prisma.InputJsonValue),
        media: source.media === null ? Prisma.DbNull : (source.media as Prisma.InputJsonValue),
        variantKey: source.variantKey,
        familyId: source.familyId,
        mainOptionId: main.id,
        installments: plan,
        price: price!,
        discount: 0,
        channelStatus: 'ACTIVE',
      },
      select: { id: true },
    });
    await tx.channelSyncChange.create({ data: { publicationId: r.id, field: 'publication', kind: 'CREATED', after: { externalId: made.externalId, copiedFrom: source.externalId }, userId: args.userId } });
    return r;
  });

  // La lectura del canal trae su medida en el canal: así se sabe si quedó junto a las otras.
  let joined = false;
  try {
    await readOne(db, { accountId: args.accountId, publicationId: row.id, now: args.now });
    const copy = await db.channelCopy.findUnique({ where: { publicationId: row.id }, select: { channelProductId: true } });
    joined = copy?.channelProductId === channelProductId;
    if (!joined) warnings.push(`${channelName} no la juntó con las otras opciones de la medida: quedó como un producto aparte. Revisala antes de crear las demás.`);
  } catch (e) {
    warnings.push('Se creó, pero todavía no se pudo leer del canal para confirmar que quedó junto a las otras opciones.');
    console.error('No se pudo leer la opción recién creada', e instanceof Error ? e.message : e);
  }
  return { id: row.id, externalId: made.externalId, url: made.url, plan: planLabel(plan), price: price!, joined, warnings };
}
